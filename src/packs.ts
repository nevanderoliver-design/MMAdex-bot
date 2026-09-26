import type { FighterCard, PackDef, PackOdds, PackType, RarityId } from "./types.js";
import { generateFighterOfRarity, rarityDef } from "./data.js";
import { logger } from "../../utils/logger.js";
import { grantDuePacks } from "./stores.js";

// ── Pack definitions ──────────────────────────────────────────────────────────
// Daily & Weekly are auto-granted on a timer and can NOT be bought.

const PACK_ODDS: Record<PackType, PackOdds[]> = {
  common: [
    { rarity: "rare", chance: 0.7 },
    { rarity: "epic", chance: 0.22 },
    { rarity: "legendary", chance: 0.07 },
    { rarity: "mythic", chance: 0.01 },
  ],
  rare: [
    { rarity: "rare", chance: 0.4 },
    { rarity: "epic", chance: 0.35 },
    { rarity: "legendary", chance: 0.2 },
    { rarity: "mythic", chance: 0.05 },
  ],
  daily: [
    { rarity: "rare", chance: 0.55 },
    { rarity: "epic", chance: 0.3 },
    { rarity: "legendary", chance: 0.13 },
    { rarity: "mythic", chance: 0.02 },
  ],
  weekly: [
    { rarity: "rare", chance: 0.4 },
    { rarity: "epic", chance: 0.35 },
    { rarity: "legendary", chance: 0.2 },
    { rarity: "mythic", chance: 0.05 },
  ],
};

export const PACKS: PackDef[] = [
  {
    id: "common",
    label: "Common Pack",
    emoji: "📦",
    price: 300,
    buyable: true,
    odds: PACK_ODDS.common,
  },
  {
    id: "rare",
    label: "Rare Pack",
    emoji: "🎁",
    price: 900,
    buyable: true,
    odds: PACK_ODDS.rare,
  },
  {
    id: "daily",
    label: "Daily Pack",
    emoji: "🌅",
    price: 0,
    buyable: false,
    odds: PACK_ODDS.daily,
  },
  {
    id: "weekly",
    label: "Weekly Pack",
    emoji: "📅",
    price: 0,
    buyable: false,
    odds: PACK_ODDS.weekly,
  },
];

export function packDef(id: PackType): PackDef {
  return PACKS.find((p) => p.id === id) ?? PACKS[0]!;
}

/** Render the odds line for a pack, e.g. "🔵 Rare — 70%". */
export function packOddsText(pack: PackDef): string {
  return pack.odds
    .map((o) => `${rarityDef(o.rarity).emoji} ${rarityDef(o.rarity).label} — ${Math.round(o.chance * 100)}%`)
    .join(" · ");
}

/** Roll a rarity from a pack's weighted odds. */
export function rollPackRarity(pack: PackDef): RarityId {
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of pack.odds) {
    cumulative += entry.chance;
    if (roll < cumulative) return entry.rarity;
  }
  return pack.odds[pack.odds.length - 1]!.rarity;
}

/** Open a pack of the given type and mint the resulting fighter card. */
export function openPack(packType: PackType, ownerId: string): { card: FighterCard; pack: PackDef } {
  const pack = packDef(packType);
  const rarity = rollPackRarity(pack);
  const card = generateFighterOfRarity(ownerId, rarity);
  return { card, pack };
}

// ── Daily / Weekly auto-grant sweep ───────────────────────────────────────────

const SWEEP_INTERVAL_MS = 60_000; // check every minute

/**
 * Periodically gran tes any due Daily / Weekly packs to known players.
 * This is the "auto-granted on a timer" mechanic the user requested.
 */
export function startPackSweep(): () => void {
  const run = async (): Promise<void> => {
    try {
      const granted = await grantDuePacks();
      if (granted > 0) {
        logger.info("Auto-granted due daily/weekly packs.", { users: granted });
      }
    } catch (error) {
      logger.error("Pack sweep failed.", { error });
    }
  };

  void run();
  const interval = setInterval(() => void run(), SWEEP_INTERVAL_MS);
  return () => clearInterval(interval);
}
