import {
  ChannelType,
  MessageFlags,
  type Client,
  type TextChannel,
} from "discord.js";
import { generateFighter, mintFighterByName } from "./data.js";
import { buildSpawnPanel, buildExpiredPanel } from "./card.js";
import { renderSpawnPoster } from "./art.js";
import { getGuildConfig, updateGuildConfig, SPAWN_EXPIRY_MS } from "./stores.js";
import type { ActiveSpawn, FighterCard, GuildConfig } from "./types.js";
import { logger } from "../../utils/logger.js";

const SPAWN_TICK_MS = 30_000;
/** How many fighters may be in the octagon at once across a guild. */
const MAX_CONCURRENT_SPAWNS = 50;

let managerStarted = false;
/** Guards against overlapping ticks when a tick takes longer than the interval. */
let tickRunning = false;

/**
 * Start the periodic spawn tick. Called once from the ready event.
 * Iterates all guilds the bot is in and spawns if due.
 */
export function startSpawnManager(client: Client): void {
  if (managerStarted) return;
  managerStarted = true;

  const tick = async (): Promise<void> => {
    // setInterval does not wait for the previous tick. During a burst of spawns a
    // tick can take longer than the interval (poster rendering + photo fetches),
    // so overlapping ticks would expire the very same spawns twice and push
    // double "Gone…" edits. Skip rather than queue.
    if (tickRunning) return;
    tickRunning = true;
    try {
      for (const guild of client.guilds.cache.values()) {
        try {
          await maybeSpawn(client, guild.id);
        } catch (err) {
          logger.error("Spawn tick error for guild.", {
            guildId: guild.id,
            error: err,
          });
        }
      }
    } finally {
      tickRunning = false;
    }
  };

  // Initial tick after a short delay so the rest of startup settles
  setTimeout(() => void tick(), 5_000);
  setInterval(() => void tick(), SPAWN_TICK_MS);
}

async function maybeSpawn(
  client: Client,
  guildId: string,
): Promise<void> {
  const cfg = await getGuildConfig(guildId);
  if (!cfg.enabled || !cfg.channelId) return;

  const now = Date.now();
  const maxAge = SPAWN_EXPIRY_MS;

  // ── Expire stale spawns individually ─────────────────────────────────────
  for (const entry of cfg.activeSpawns) {
    if (now - entry.spawnedAt > maxAge) {
      await expireSpawn(client, guildId, entry);
    }
  }

  const fresh = await getGuildConfig(guildId);

  // ── Don't stack more than the concurrent cap ─────────────────────────────
  if (fresh.activeSpawns.length >= MAX_CONCURRENT_SPAWNS) return;

  // ── Check if it's time to spawn ──────────────────────────────────────────
  const elapsed = fresh.lastSpawnAt ? now - fresh.lastSpawnAt : now;
  if (elapsed < fresh.intervalMinutes * 60_000) return;

  await spawnFighterToGuild(client, guildId, fresh);
}

async function spawnFighterToGuild(
  client: Client,
  guildId: string,
  cfg: GuildConfig,
  card: FighterCard = generateFighter("pending"),
): Promise<void> {
  if (!cfg.channelId) return;
  // Captured so the narrowing survives into the updater callback below.
  const channelId = cfg.channelId;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel || channel.type !== ChannelType.GuildText || !("send" in channel)) {
    logger.warn("Spawn channel not found or not text-based.", {
      guildId,
      channelId: cfg.channelId,
    });
    return;
  }

  const textChannel = channel as TextChannel;

  // Render the cinematic 1:1 square spawn poster (name hidden)
  let posterBuffer: Buffer | null = null;
  try {
    posterBuffer = await renderSpawnPoster(card, { revealed: false });
  } catch (err) {
    logger.warn("Spawn poster render failed, sending panel without an image.", {
      guildId,
      fighterId: card.id,
      error: err,
    });
  }

  const panel = buildSpawnPanel(card, Boolean(posterBuffer));

  const msg = await textChannel.send({
    files: posterBuffer ? [{ attachment: posterBuffer, name: "spawn.png" }] : undefined,
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });

  // Track this spawn as one of several concurrently active entries. The write goes
  // through the serialised updater so it lands on the freshest list: the poster
  // render and channel send above take seconds, and writing back the snapshot that
  // was read before them would drop spawns added in the meantime and resurrect
  // entries that were claimed or expired while this poster was rendering.
  const spawnedAt = Date.now();
  await updateGuildConfig(guildId, (fresh) => {
    if (fresh.activeSpawns.some((e) => e.messageId === msg.id)) return;
    fresh.activeSpawns.push({
      fighter: card,
      messageId: msg.id,
      channelId,
      spawnedAt,
    });
    fresh.lastSpawnAt = spawnedAt;
    fresh.spawnCount += 1;
  });

  logger.info("Fighter spawned.", {
    guildId,
    fighterId: card.id,
    name: card.name,
  });
}

/** Reveal an expired spawn's poster and remove it from the active list. */
async function expireSpawn(
  client: Client,
  guildId: string,
  entry: ActiveSpawn,
): Promise<void> {
  // Take the entry off the board *first*, and only edit the message when it was
  // really still tracked. Editing first let a slow tick overwrite a card that had
  // just been claimed — or one an earlier tick had already expired — with the
  // "Gone…" panel, because the tick works from a snapshot taken before its awaits.
  const removed = await updateGuildConfig(guildId, (cfg) => {
    const index = cfg.activeSpawns.findIndex(
      (e) => e.messageId === entry.messageId,
    );
    if (index === -1) return false;
    cfg.activeSpawns.splice(index, 1);
    return true;
  });
  if (!removed) return;

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel =
      guild.channels.cache.get(entry.channelId) ??
      (await guild.channels.fetch(entry.channelId).catch(() => null));
    if (channel && "messages" in channel) {
      const textChannel = channel as TextChannel;
      const msg = await textChannel.messages
        .fetch(entry.messageId)
        .catch(() => null);
      if (msg) {
        const panel = buildExpiredPanel(entry.fighter);
        // Render the revealed poster (name revealed after expiry)
        let revealedBuffer: Buffer | null = null;
        try {
          revealedBuffer = await renderSpawnPoster(entry.fighter, {
            revealed: true,
          });
        } catch (err) {
          logger.warn("Revealed poster render failed, editing text-only.", {
            guildId,
            error: err,
          });
        }
        if (revealedBuffer) {
          panel.addMediaGalleryComponents((gallery) =>
            gallery.addItems({ media: { url: "attachment://spawn.png" } }),
          );
        }
        await msg.edit({
          attachments: [],
          files: revealedBuffer
            ? [{ attachment: revealedBuffer, name: "spawn.png" }]
            : undefined,
          components: [panel],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }
  } catch (err) {
    logger.warn("Could not edit expired spawn message.", {
      guildId,
      error: err,
    });
  }
}

/**
 * Force a spawn immediately (admin command).
 * Returns an error string or null on success.
 */
export async function spawnNow(
  client: Client,
  guildId: string,
): Promise<string | null> {
  const cfg = await getGuildConfig(guildId);
  if (!cfg.channelId) {
    return "No spawn channel is set. Use **/setup** first.";
  }
  if (cfg.activeSpawns.length >= MAX_CONCURRENT_SPAWNS) {
    return `There are already ${MAX_CONCURRENT_SPAWNS} active fighters in the octagon. Let some get claimed first.`;
  }

  await spawnFighterToGuild(client, guildId, cfg);
  return null;
}

/**
 * Force a specific fighter to spawn immediately (admin command).
 * Resolves the fighter by exact name from the static database.
 */
export async function spawnSpecific(
  client: Client,
  guildId: string,
  fighterName: string,
): Promise<string | null> {
  const cfg = await getGuildConfig(guildId);
  if (!cfg.channelId) {
    return "No spawn channel is set. Use **/setup** first.";
  }
  if (cfg.activeSpawns.length >= MAX_CONCURRENT_SPAWNS) {
    return `There are already ${MAX_CONCURRENT_SPAWNS} active fighters in the octagon. Let some get claimed first.`;
  }

  const card = mintFighterByName(fighterName, "pending");
  if (!card) {
    return `Fighter **${fighterName}** not found in the database.`;
  }

  await spawnFighterToGuild(client, guildId, cfg, card);
  return null;
}

/**
 * Force several fighters to spawn at once (admin command). Re-reads the config
 * each iteration so concurrently-active entries are preserved correctly.
 */
export async function massSpawn(
  client: Client,
  guildId: string,
  count: number,
): Promise<string | null> {
  const cfg = await getGuildConfig(guildId);
  if (!cfg.channelId) {
    return "No spawn channel is set. Use **/setup** first.";
  }
  if (cfg.activeSpawns.length + count > MAX_CONCURRENT_SPAWNS) {
    return `Only ${Math.max(0, MAX_CONCURRENT_SPAWNS - cfg.activeSpawns.length)} free slot(s) left in the octagon. Claim some fighters first.`;
  }

  for (let i = 0; i < count; i++) {
    const fresh = await getGuildConfig(guildId);
    if (!fresh.channelId) return "No spawn channel is set. Use **/setup** first.";
    await spawnFighterToGuild(client, guildId, fresh);
  }
  return null;
}