import { loadConfig } from "../../config.js";
import { createJsonStore, createStorage } from "../../utils/storage.js";
import type { FighterCard, GuildConfig, MarketListing, PackType, TradeProposal, UserProfile } from "./types.js";
import { logger } from "../../utils/logger.js";

// ── Store singletons ──────────────────────────────────────────────────────────
const config = loadConfig();

/** Per-guild config: spawn channel, interval, pending fighter. */
export const guildConfigs = createStorage<GuildConfig>(config, "mma-guilds");

/** Per-user profile: coins, stats. */
export const userProfiles = createStorage<UserProfile>(config, "mma-users");

/** Per-user inventory: list of owned fighter cards. */
export const userInventories = createStorage<FighterCard[]>(config, "mma-inventory");

/** Global market listing registry. */
export const marketStore = createJsonStore<Record<string, MarketListing>>(
  config,
  "mma-market.json",
  {},
);

/** Global trade proposals registry. */
export const tradeStore = createJsonStore<Record<string, TradeProposal>>(
  config,
  "mma-trades.json",
  {},
);

/** Registry of known player IDs so the pack sweep can auto-grant Daily/Weekly packs. */
const playerRegistry = createJsonStore<string[]>(config, "mma-players.json", []);
let registeredIds = new Set<string>();
let registryLoaded = false;

async function ensureRegistryLoaded(): Promise<void> {
  if (registryLoaded) return;
  for (const id of await playerRegistry.read()) registeredIds.add(id);
  registryLoaded = true;
}

/** Ensure a player is tracked by the auto-grant sweep (no-op if already tracked). */
export async function registerUser(userId: string): Promise<void> {
  await ensureRegistryLoaded();
  if (registeredIds.has(userId)) return;
  registeredIds.add(userId);
  await playerRegistry.update((ids) => {
    if (!ids.includes(userId)) ids.push(userId);
    return ids;
  });
}

/** Cadence for Daily (24h) and Weekly (7d) pack auto-grants. */
export const PACK_DAILY_MS = 24 * 60 * 60 * 1000;
export const PACK_WEEKLY_MS = 7 * PACK_DAILY_MS;

/**
 * Grant any due Daily / Weekly packs to all tracked players.
 * A player gets one Daily pack per elapsed 24h period (cap 7) and one Weekly
 * pack per elapsed 7-day period (cap 4). Returns the number of players updated.
 */
export async function grantDuePacks(now = Date.now()): Promise<number> {
  await ensureRegistryLoaded();
  await playerRegistry.update((ids) => {
    for (const id of registeredIds) if (!ids.includes(id)) ids.push(id);
    return ids;
  });

  let granted = 0;
  for (const userId of await playerRegistry.read()) {
    const profile = await getProfile(userId);
    const dailyDue = !profile.lastDailyPackAt || now - profile.lastDailyPackAt >= PACK_DAILY_MS;
    const weeklyDue = !profile.lastWeeklyPackAt || now - profile.lastWeeklyPackAt >= PACK_WEEKLY_MS;
    if (!dailyDue && !weeklyDue) continue;

    if (dailyDue) {
      const missed = profile.lastDailyPackAt
        ? Math.floor((now - profile.lastDailyPackAt) / PACK_DAILY_MS) + 1
        : 1;
      profile.packs.daily += Math.min(missed, 7);
      profile.lastDailyPackAt = now;
    }
    if (weeklyDue) {
      const missed = profile.lastWeeklyPackAt
        ? Math.floor((now - profile.lastWeeklyPackAt) / PACK_WEEKLY_MS) + 1
        : 1;
      profile.packs.weekly += Math.min(missed, 4);
      profile.lastWeeklyPackAt = now;
    }
    await saveProfile(userId, profile);
    granted++;
  }
  return granted;
}

// ── Default factory helpers ───────────────────────────────────────────────────

export function emptyPacks(): Record<PackType, number> {
  return { common: 0, rare: 0, daily: 0, weekly: 0 };
}

const DEFAULT_GUILD_CONFIG: Omit<GuildConfig, never> = {
  intervalMinutes: 30,
  enabled: false,
  activeSpawns: [],
  spawnCount: 0,
};

export function defaultGuildConfig(): GuildConfig {
  return { ...DEFAULT_GUILD_CONFIG };
}

export function defaultProfile(): UserProfile {
  return {
    coins: 500,
    caught: 0,
    bestPower: 0,
    createdAt: Date.now(),
    packs: emptyPacks(),
  };
}

// ── Profile operations ────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<UserProfile> {
  const stored = await userProfiles.read(userId);
  const profile: UserProfile = stored
    ? {
        ...stored,
        packs: stored.packs ?? emptyPacks(),
      }
    : defaultProfile();
  // Track the player so the Daily/Weekly auto-grant sweep reaches them.
  await registerUser(userId);
  return profile;
}

export async function saveProfile(userId: string, profile: UserProfile): Promise<void> {
  await userProfiles.write(userId, profile);
}

/** Add coins to a user's balance. Returns new total. */
export async function addCoins(userId: string, amount: number): Promise<number> {
  const profile = await getProfile(userId);
  profile.coins += amount;
  await saveProfile(userId, profile);
  return profile.coins;
}

/** Try to spend coins; returns true if successful, false if insufficient. */
export async function trySpendCoins(userId: string, amount: number): Promise<boolean> {
  const profile = await getProfile(userId);
  if (profile.coins < amount) return false;
  profile.coins -= amount;
  await saveProfile(userId, profile);
  return true;
}

// ── Pack inventory operations ─────────────────────────────────────────────────

export async function getPackCounts(userId: string): Promise<Record<PackType, number>> {
  const profile = await getProfile(userId);
  return profile.packs;
}

export async function addPacks(userId: string, packType: PackType, count = 1): Promise<number> {
  const profile = await getProfile(userId);
  profile.packs[packType] = (profile.packs[packType] ?? 0) + count;
  await saveProfile(userId, profile);
  return profile.packs[packType];
}

/** Consume one pack if owned. Returns false if the user has none. */
export async function tryUsePack(userId: string, packType: PackType): Promise<boolean> {
  const profile = await getProfile(userId);
  if ((profile.packs[packType] ?? 0) <= 0) return false;
  profile.packs[packType] -= 1;
  await saveProfile(userId, profile);
  return true;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export type LeaderboardMetric = "cards" | "coins" | "power" | "caught" | "dupes";

export interface LeaderboardEntry {
  userId: string;
  value: number;
  /** Extra context, e.g. the fighter name for the "same fighter" metric. */
  label?: string;
  cards: number;
}

/**
 * Compute a ranked leaderboard across every player with a profile.
 * `metric` selects what is compared. Users with nothing for the metric
 * (e.g. zero coins, no fighters) are included so their rank is honest.
 */
export async function computeLeaderboard(
  metric: LeaderboardMetric,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const userIds = await userProfiles.keys();
  const entries: LeaderboardEntry[] = [];

  for (const userId of userIds) {
    const profile = await getProfile(userId);
    const cards = await getInventory(userId);
    let value = 0;
    let label: string | undefined;

    switch (metric) {
      case "cards":
        value = cards.length;
        break;
      case "coins":
        value = profile.coins;
        break;
      case "power":
        value = profile.bestPower;
        break;
      case "caught":
        value = profile.caught;
        break;
      case "dupes": {
        const counts = new Map<string, number>();
        let maxCount = 0;
        let maxName = "";
        for (const card of cards) {
          const n = (counts.get(card.name) ?? 0) + 1;
          counts.set(card.name, n);
          if (n > maxCount) {
            maxCount = n;
            maxName = card.name;
          }
        }
        value = maxCount;
        label = maxName;
        break;
      }
    }

    entries.push({ userId, value, label, cards: cards.length });
  }

  entries.sort((a, b) => b.value - a.value || b.cards - a.cards);
  return entries.slice(0, limit);
}

// ── Inventory operations ──────────────────────────────────────────────────────

export async function getInventory(userId: string): Promise<FighterCard[]> {
  return (await userInventories.read(userId)) ?? [];
}

export async function saveInventory(userId: string, cards: FighterCard[]): Promise<void> {
  await userInventories.write(userId, cards);
}

/** Add a card to a user's inventory and update their profile. */
export async function addCardToUser(
  userId: string,
  card: FighterCard,
): Promise<void> {
  const inv = await getInventory(userId);
  inv.push(card);
  await saveInventory(userId, inv);

  const profile = await getProfile(userId);
  profile.caught++;
  if (card.power > profile.bestPower) {
    profile.bestPower = card.power;
    profile.bestId = card.id;
  }
  await saveProfile(userId, profile);
}

/**
 * Move a card from one user to another.
 * Returns false if the card does not belong to `fromId`.
 */
export async function moveCard(
  fromId: string,
  toId: string,
  fighterId: string,
): Promise<boolean> {
  const from = await getInventory(fromId);
  const idx = from.findIndex((c) => c.id === fighterId && c.ownerId === fromId);
  if (idx < 0) return false;
  const [card] = from.splice(idx, 1);
  card.ownerId = toId;

  const to = await getInventory(toId);
  to.push(card);

  await saveInventory(fromId, from);
  await saveInventory(toId, to);
  return true;
}

/**
 * Remove a card by id from a user's inventory.
 * Returns the removed card or undefined.
 */
export async function removeCardFromUser(
  userId: string,
  fighterId: string,
): Promise<FighterCard | undefined> {
  const inv = await getInventory(userId);
  const idx = inv.findIndex((c) => c.id === fighterId);
  if (idx < 0) return undefined;
  const [card] = inv.splice(idx, 1);
  await saveInventory(userId, inv);
  return card;
}

// ── Guild config helpers ───────────────────────────────────────────────────────

/** Legacy persisted shape (single pending spawn) migrated into activeSpawns. */
type LegacyGuildConfig = GuildConfig & {
  pendingFighter?: FighterCard;
  spawnMessageId?: string;
};

/** How long a spawn stays claimable. Shared with the spawner's expiry tick. */
export const SPAWN_EXPIRY_MS = 15 * 60_000;

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const stored = (await guildConfigs.read(guildId)) as LegacyGuildConfig | undefined;
  const raw: LegacyGuildConfig = stored ?? ({} as LegacyGuildConfig);

  // `pendingFighter`/`spawnMessageId` are deliberately destructured out so they
  // are never written back. Keeping them would let the migration below re-fire
  // every single time the octagon emptied, resurrecting an old spawn whose
  // `spawnedAt` was already long past — so the next tick immediately expired it
  // again and an old card kept flipping to "Gone…".
  const { pendingFighter, spawnMessageId, ...rest } = raw;
  const cfg: GuildConfig = stored
    ? {
        ...(rest as GuildConfig),
        activeSpawns: stored.activeSpawns ?? [],
        intervalMinutes: stored.intervalMinutes ?? 30,
        enabled: stored.enabled ?? false,
        spawnCount: stored.spawnCount ?? 0,
      }
    : defaultGuildConfig();

  // One-shot migration: configs from the single-spawn era stored the pending
  // fighter separately. Promote it once, and only while it is genuinely still
  // inside its expiry window.
  if (cfg.activeSpawns.length === 0 && pendingFighter && spawnMessageId) {
    const spawnedAt = stored?.lastSpawnAt ?? Date.now();
    if (Date.now() - spawnedAt < SPAWN_EXPIRY_MS) {
      cfg.activeSpawns = [
        {
          fighter: pendingFighter,
          messageId: spawnMessageId,
          channelId: stored?.channelId ?? cfg.channelId ?? "",
          spawnedAt,
        },
      ];
    }
  }

  return cfg;
}

/**
 * Serialises read-modify-write cycles per guild.
 *
 * Spawning, claiming and expiring all mutate the same document. A plain
 * read → mutate → write loses whichever change landed first, because the base
 * snapshot is taken before slow work (poster rendering, channel sends). Two
 * spawns at once could therefore revert each other's tracking, resurrect an
 * already-claimed or already-expired entry, and re-trigger expiry edits.
 */
const guildConfigQueues = new Map<string, Promise<unknown>>();

/**
 * Atomically mutate a guild's config: reads the freshest copy, applies `mutate`,
 * then writes it back. `mutate` may return a value (for example the entry it
 * removed) which is passed through to the caller.
 */
export async function updateGuildConfig<T>(
  guildId: string,
  mutate: (cfg: GuildConfig) => T | Promise<T>,
): Promise<T> {
  const previous = guildConfigQueues.get(guildId) ?? Promise.resolve();
  const run = async (): Promise<T> => {
    const cfg = await getGuildConfig(guildId);
    const result = await mutate(cfg);
    await guildConfigs.write(guildId, cfg);
    return result;
  };
  // Run after the previous cycle whether it resolved or rejected, so one failed
  // update never blocks a guild's queue forever.
  const task = previous.then(run, run);
  guildConfigQueues.set(
    guildId,
    task.catch(() => undefined),
  );
  return task;
}

// ── Market helpers ────────────────────────────────────────────────────────────

/**
 * List a fighter on the market. Returns the listing id on success or null if
 * the card could not be found in the seller's inventory.
 */
export async function listOnMarket(
  sellerId: string,
  fighterId: string,
  price: number,
): Promise<string | null> {
  // Verify ownership first (fast check)
  const inv = await getInventory(sellerId);
  const card = inv.find((c) => c.id === fighterId);
  if (!card || card.ownerId !== sellerId) return null;

  const listingId = Math.random().toString(36).slice(2, 10);
  await marketStore.update((listings) => {
    listings[listingId] = {
      id: listingId,
      fighterId,
      sellerId,
      price,
      listedAt: Date.now(),
    };
  });
  return listingId;
}

/** Remove a listing. Returns true if it existed. */
export async function unlistFromMarket(listingId: string): Promise<boolean> {
  let removed = false;
  await marketStore.update((listings) => {
    if (listings[listingId]) {
      delete listings[listingId];
      removed = true;
    }
  });
  return removed;
}

/** Get a single listing (includes full market data in the record). */
export async function getListing(listingId: string): Promise<MarketListing | undefined> {
  const all = await marketStore.read();
  return all[listingId];
}

/** Get all market listings. */
export async function getAllListings(): Promise<MarketListing[]> {
  const all = await marketStore.read();
  return Object.values(all);
}

/**
 * Buy a fighter from the market. Atomic verification + removal; on success
 * returns the listing. On failure returns null.
 */
export async function buyFromMarket(listingId: string, buyerId: string): Promise<MarketListing | null> {
  // Remove listing atomically
  let listing: MarketListing | undefined;
  await marketStore.update((listings) => {
    const l = listings[listingId];
    if (!l) return;
    if (l.sellerId === buyerId) return; // can't buy own
    listing = { ...l };
    delete listings[listingId];
  });
  if (!listing) return null;
  const sold = listing;

  // Move card
  const moved = await moveCard(sold.sellerId, buyerId, sold.fighterId);
  if (!moved) {
    // Card lost? restore listing
    logger.error("Market buy: card not found in seller inventory — restoring listing", {
      listingId: sold.id,
      fighterId: sold.fighterId,
      sellerId: sold.sellerId,
    });
    await marketStore.update((listings) => {
      listings[sold.id] = sold;
    });
    return null;
  }

  // Transfer coins — buyer spends, seller earns
  const spent = await trySpendCoins(buyerId, sold.price);
  if (!spent) {
    // Buyer lost coins between confirm and execution; revert card move
    await moveCard(buyerId, sold.sellerId, sold.fighterId);
    await marketStore.update((listings) => {
      listings[sold.id] = sold;
    });
    return null;
  }
  await addCoins(sold.sellerId, sold.price);

  return sold;
}

// ── Trade helpers ─────────────────────────────────────────────────────────────

export async function createTrade(proposal: TradeProposal): Promise<void> {
  await tradeStore.update((trades) => {
    trades[proposal.id] = proposal;
  });
}

export async function getTrade(tradeId: string): Promise<TradeProposal | undefined> {
  const all = await tradeStore.read();
  return all[tradeId];
}

export async function saveTrade(proposal: TradeProposal): Promise<void> {
  await tradeStore.update((trades) => {
    trades[proposal.id] = proposal;
  });
}

export async function removeTrade(tradeId: string): Promise<void> {
  await tradeStore.update((trades) => {
    delete trades[tradeId];
  });
}