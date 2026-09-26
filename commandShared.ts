import {
  ChannelType,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  CheckboxBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Guild,
  type GuildMember,
  type APIInteractionGuildMember,
  type User,
} from "discord.js";
import { getClient, getClientIfAvailable } from "../../bot/client.js";
import { logger } from "../../utils/logger.js";
import { loadConfig } from "../../config.js";
import { rarityDef } from "./data.js";
import {
  buildFighterPanel,
  buildInventoryPanel,
  buildMarketPanel,
  buildTradePanel,
  buildTradeResultPanel,
  buildHelpPanel,
  buildClaimedPanel,
  CARD_FOOTER,
  type MarketRow,
} from "./card.js";
import {
  renderFighterCard,
  renderTradePoster,
  renderSpawnPoster,
  getFighterPhotoUrl,
} from "./art.js";
import {
  getGuildConfig,
  updateGuildConfig,
  getProfile,
  addCoins,
  trySpendCoins,
  getInventory,
  addCardToUser,
  moveCard,
  getAllListings,
  listOnMarket,
  unlistFromMarket,
  buyFromMarket,
  getTrade,
  saveTrade,
  createTrade,
} from "./stores.js";
import { spawnNow } from "./spawner.js";
import type { FighterCard, TradeProposal } from "./types.js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const FIGHTERS_PER_INV_PAGE = 4;
export const FIGHTERS_PER_MARKET_PAGE = 5;

const claimLock = new Set<string>();

const BOT_OWNER_IDS = loadConfig().ownerIds;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Any interaction that can carry guild + member permission data. */
interface GuildPermissionContext {
  user: { id: string };
  guildId: string | null;
  guild: Guild | null;
  /** Raw API payload when the member is not cached, instead of a GuildMember. */
  member?: GuildMember | APIInteractionGuildMember | null;
  memberPermissions?: Readonly<PermissionsBitField> | null;
}

/** The permission a member needs to configure the arena in their server. */
const ARENA_PERMISSION = PermissionFlagsBits.ManageGuild;

/**
 * Coerce whatever Discord sent for a member's permissions into a bitfield.
 *
 * The bot only requests the Guilds intent, so members are almost never cached and
 * `interaction.member` is usually the raw API payload whose `permissions` is a
 * plain decimal string. Calling `.has()` on that string throws, which is exactly
 * why /setup worked for the bot owner (short-circuited) but failed for a normal
 * server owner in any other server.
 */
function toBitfield(value: unknown): PermissionsBitField | null {
  if (value instanceof PermissionsBitField) return value;
  if (typeof value === "bigint") {
    return new PermissionsBitField(value);
  }
  if (typeof value === "number" || (typeof value === "string" && value.length > 0)) {
    try {
      return new PermissionsBitField(BigInt(value));
    } catch {
      return null;
    }
  }
  return null;
}

/** The guild this interaction happened in, falling back to the client cache. */
function resolveGuild(context: GuildPermissionContext): Guild | null {
  if (context.guild) return context.guild;
  if (!context.guildId) return null;
  return getClientIfAvailable()?.guilds.cache.get(context.guildId) ?? null;
}

/**
 * Whether the user may configure the arena in the server where the interaction
 * happened: the bot owner, that server's owner, or a member with Manage Server.
 *
 * Every guild is checked against its own id, so this behaves identically in the
 * bot's home server and in any other server the bot has been invited to.
 */
export async function isGuildAdmin(
  context: GuildPermissionContext,
): Promise<boolean> {
  const userId = context.user.id;
  if (BOT_OWNER_IDS.includes(userId)) return true;

  const guild = resolveGuild(context);

  // A server owner always controls their own server, even when the interaction
  // payload carries no computed permissions.
  if (guild?.ownerId === userId) return true;

  const fromInteraction =
    toBitfield(context.memberPermissions) ??
    toBitfield(
      (context.member as { permissions?: unknown } | null | undefined)?.permissions,
    );
  if (fromInteraction?.has(ARENA_PERMISSION) === true) return true;

  // Nothing usable in the payload — ask Discord for the member once.
  if (!guild) return false;
  try {
    const member = await guild.members.fetch(userId);
    return member.permissions.has(ARENA_PERMISSION);
  } catch (err) {
    logger.warn("Could not resolve guild permissions.", {
      guildId: context.guildId,
      userId,
      error: err,
    });
    return false;
  }
}

type MemberCarrier =
  | { member: GuildMember | APIInteractionGuildMember | null; user: User }
  | { member: GuildMember | null; user: User };

export function memberName(interaction: MemberCarrier): string {
  const m = interaction.member;
  if (m && "displayName" in m) return m.displayName;
  return interaction.user.displayName;
}

// ==============================================================================
//  Slash Command Handlers
// ==============================================================================

export async function handleSetup(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!(await isGuildAdmin(interaction))) {
    await interaction.reply({
      content: "You need **Manage Server** permission to configure the arena.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cfg = await getGuildConfig(interaction.guildId!);

  const modal = new ModalBuilder()
    .setCustomId("setup:config")
    .setTitle("Octagon Setup")
    .addTextDisplayComponents((text) =>
      text.setContent(
        "Fighters will auto-spawn **every 30 minutes** in the arena channel you choose.",
      ),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Arena Channel")
        .setDescription("Where fighters will spawn.")
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId("channel")
            .setChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("Enable Spawns?")
        .setDescription("Check to turn on automatic spawning.")
        .setCheckboxComponent(
          new CheckboxBuilder()
            .setCustomId("enabled")
            // On a fresh server (no channel set yet) default to ON so setting up
            // automatically starts spawning instead of silently doing nothing.
            .setDefault(cfg.channelId ? cfg.enabled : true),
        ),
    );

  await interaction.showModal(modal);
}

export async function handleSpawnNow(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!(await isGuildAdmin(interaction))) {
    await interaction.reply({
      content: "You need **Manage Server** permission to force a spawn.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const error = await spawnNow(getClient(), interaction.guildId!);
  if (error) {
    await interaction.editReply({ content: error });
    return;
  }

  const cfg = await getGuildConfig(interaction.guildId!);
  await interaction.editReply({
    content: `⚡ A fighter has entered the octagon in <#${cfg.channelId}>!`,
  });
}

export async function handleBalance(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const profile = await getProfile(interaction.user.id);
  const cards = await getInventory(interaction.user.id);

  await interaction.editReply({
    content: [
      `# 🪙 Your Balance`,
      `**Coins:** ${profile.coins.toLocaleString()}`,
      `**Fighters caught:** ${profile.caught}`,
      `**In your corner:** ${cards.length}`,
      `**Best fighter power:** ${profile.bestPower > 0 ? profile.bestPower : "—"}`,
      ``,
      CARD_FOOTER,
    ].join("\n"),
  });
}

export async function handleGiveCoin(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const target = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);

  if (target.id === interaction.user.id) {
    await interaction.reply({
      content: "You can't give coins to yourself.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (target.bot) {
    await interaction.reply({
      content: "You can't give coins to a bot.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const gifted = await trySpendCoins(interaction.user.id, amount);
  if (!gifted) {
    await interaction.editReply({
      content: "You don't have enough coins for that.",
    });
    return;
  }

  const newBalance = await addCoins(target.id, amount);
  const giver = await getProfile(interaction.user.id);

  await interaction.editReply({
    content: [
      `✅ You gave 🪙 **${amount.toLocaleString()}** to <@${target.id}>.`,
      `Their balance is now 🪙 **${newBalance.toLocaleString()}**.`,
      `Your balance is now 🪙 **${giver.coins.toLocaleString()}**.`,
      "",
      CARD_FOOTER,
    ].join("\n"),
  });
}

export async function handleGiveFighter(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const target = interaction.options.getUser("user", true);
  const fighterId = interaction.options.getString("fighter", true);

  if (target.id === interaction.user.id) {
    await interaction.reply({
      content: "You can't give a fighter to yourself.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (target.bot) {
    await interaction.reply({
      content: "You can't give a fighter to a bot.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Can't hand over a fighter that's currently listed on the market — unlist first.
  const listedIds = new Set((await getAllListings()).map((l) => l.fighterId));
  if (listedIds.has(fighterId)) {
    await interaction.editReply({
      content:
        "That fighter is **listed on the market**. Unlist it first with `/unlist <card>` before giving it away.",
    });
    return;
  }

  const moved = await moveCard(interaction.user.id, target.id, fighterId);
  if (!moved) {
    await interaction.editReply({
      content: "You don't own that fighter.",
    });
    return;
  }

  const targetInv = await getInventory(target.id);
  const card = targetInv.find((c) => c.id === fighterId);

  await interaction.editReply({
    content: card
      ? `✅ You gave **${card.name}** (⚡ ${card.power}) to <@${target.id}>.`
      : `✅ Fighter given to <@${target.id}>.`,
    allowedMentions: { parse: [] },
  });
}

export async function handleInventory(
  interaction: ChatInputCommandInteraction,
  page: number,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const profile = await getProfile(userId);
  const allCards = await getInventory(userId);
  const totalPages = Math.max(1, Math.ceil(allCards.length / FIGHTERS_PER_INV_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageCards = allCards.slice(
    safePage * FIGHTERS_PER_INV_PAGE,
    (safePage + 1) * FIGHTERS_PER_INV_PAGE,
  );

  // Fetch photo URLs for the page's fighters
  const photoUrls: Record<string, string | null> = {};
  for (const card of pageCards) {
    try {
      photoUrls[card.id] = await getFighterPhotoUrl(card.name);
    } catch {
      photoUrls[card.id] = null;
    }
  }

  const panel = buildInventoryPanel(profile, pageCards, safePage, totalPages, photoUrls);
  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

export async function handleView(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const fighterId = interaction.options.getString("fighter", true);
  const userId = interaction.user.id;
  const cards = await getInventory(userId);
  const card = cards.find((c) => c.id === fighterId);

  if (!card) {
    await interaction.editReply({ content: "You don't own a fighter with that ID." });
    return;
  }

  const listings = await getAllListings();
  const isListed = listings.some((l) => l.fighterId === card.id);
  const panel = buildFighterPanel(card, interaction.user.displayName, !isListed);

  // Render the premium fighter card image and display it inline in the panel
  let cardBuffer: Buffer | null = null;
  try {
    cardBuffer = await renderFighterCard(card);
  } catch (err) {
    logger.warn("Fighter card render failed, sending text-only panel.", {
      fighterId: card.id,
      error: err,
    });
  }

  if (cardBuffer) {
    panel.addMediaGalleryComponents((gallery) =>
      gallery.addItems({ media: { url: "attachment://card.png" } }),
    );
  }

  await interaction.editReply({
    files: cardBuffer ? [{ attachment: cardBuffer, name: "card.png" }] : undefined,
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
}

export async function handleListCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const fighterId = interaction.options.getString("fighter", true);
  const price = interaction.options.getInteger("price", true);
  const userId = interaction.user.id;

  const result = await listOnMarket(userId, fighterId, price);
  if (!result) {
    await interaction.editReply({ content: "Could not find that fighter in your inventory. Make sure it's not already listed." });
    return;
  }

  await interaction.editReply({
    content: `✅ **${fighterId}** listed for 🪙 **${price.toLocaleString()}** Coins.`,
  });
}

export async function handleUnlistCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const fighterId = interaction.options.getString("fighter", true);
  const userId = interaction.user.id;

  const listings = await getAllListings();
  const listing = listings.find((l) => l.fighterId === fighterId && l.sellerId === userId);
  if (!listing) {
    await interaction.editReply({ content: "That fighter is not listed on the market." });
    return;
  }

  await unlistFromMarket(listing.id);
  await interaction.editReply({ content: `✅ Fighter unlisted from the market.` });
}

export async function handleMarket(
  interaction: ChatInputCommandInteraction,
  page: number,
): Promise<void> {
  // Market is public
  await interaction.deferReply();

  await renderMarketPage(interaction, page);
}

async function renderMarketPage(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  page: number,
): Promise<void> {
  const listings = await getAllListings();
  const totalPages = Math.max(1, Math.ceil(listings.length / FIGHTERS_PER_MARKET_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageListings = listings.slice(
    safePage * FIGHTERS_PER_MARKET_PAGE,
    (safePage + 1) * FIGHTERS_PER_MARKET_PAGE,
  );

  const rows: MarketRow[] = [];
  for (const listing of pageListings) {
    const sellerInv = await getInventory(listing.sellerId);
    const card = sellerInv.find((c) => c.id === listing.fighterId);
    if (card) {
      rows.push({ listing, card });
    }
  }

  const panel = buildMarketPanel(rows, safePage, totalPages);

  if (interaction.isButton()) {
    await interaction.deferUpdate();
    await interaction.editReply({
      components: [panel],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
  } else {
    await interaction.editReply({
      components: [panel],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
  }
}

export async function handleTrade(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const target = interaction.options.getUser("user", true);
  const userId = interaction.user.id;

  if (target.id === userId) {
    await interaction.reply({
      content: "You can't trade with yourself.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (target.bot) {
    await interaction.reply({
      content: "You can't trade with bots.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const myCards = await getInventory(userId);
  const targetCards = await getInventory(target.id);

  if (targetCards.length === 0) {
    await interaction.reply({
      content: `${target.displayName} has no fighters to trade.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const fighterOptions = (cards: FighterCard[], limit = 25) => {
    const slice = cards.slice(0, limit);
    const nameCount = new Map<string, number>();
    for (const c of slice) nameCount.set(c.name, (nameCount.get(c.name) ?? 0) + 1);
    const ordinal = new Map<string, number>();

    return slice.map((c) => {
      const isDupe = (nameCount.get(c.name) ?? 0) > 1;
      const n = isDupe ? (ordinal.get(c.name) ?? 0) + 1 : 0;
      if (isDupe) ordinal.set(c.name, n);
      const label = isDupe
        ? `#${n} ${c.name} (⚡ ${c.power}, ${rarityDef(c.rarity).label})`.slice(0, 100)
        : `${c.name} (⚡ ${c.power}, ${rarityDef(c.rarity).label})`.slice(0, 100);
      return { label, value: c.id, description: c.division.slice(0, 100) };
    });
  };

  const myOptions = fighterOptions(myCards);
  const targetOptions = fighterOptions(targetCards);

  const modal = new ModalBuilder()
    .setCustomId(`trade:trade-modal:${target.id}`)
    .setTitle("Propose Trade")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Your Fighter")
        .setDescription("Optional — leave empty for coin-only offer.")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("offerFighter")
            .setRequired(false)
            .setMinValues(0)
            .setMaxValues(1)
            .addOptions(
              myOptions.length > 0
                ? myOptions
                : [{ label: "No fighters to offer", value: "_none", default: true }],
            ),
        ),
      new LabelBuilder()
        .setLabel("Coins to Add")
        .setDescription("Optional — coins you add to the offer.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("coins")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("0")
            .setRequired(false),
        ),
      new LabelBuilder()
        .setLabel("Want Their Fighter")
        .setDescription("The fighter you want from them.")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("wantFighter")
            .setRequired(true)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(targetOptions),
        ),
    );

  await interaction.showModal(modal);
}

export async function handleHelp(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const panel = buildHelpPanel();
  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

// ==============================================================================
//  Autocomplete
// ==============================================================================

export async function runFighterAutocomplete(
  interaction: AutocompleteInteraction,
  mode: "view" | "list" | "unlist" | "give",
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const userId = interaction.user.id;

  let fighters: FighterCard[];

  const inv = await getInventory(userId);
  if (mode === "unlist") {
    const listings = await getAllListings();
    const myListings = listings.filter((l) => l.sellerId === userId);
    const listedIds = new Set(myListings.map((l) => l.fighterId));
    fighters = inv.filter((c) => listedIds.has(c.id));
  } else if (mode === "list" || mode === "give") {
    // Both "list" and "give" operate on own cards that aren't already for sale.
    const listings = await getAllListings();
    const listedIds = new Set(listings.map((l) => l.fighterId));
    fighters = inv.filter((c) => !listedIds.has(c.id));
  } else {
    fighters = inv;
  }

  const query = String(focused.value).toLowerCase();
  const filtered = fighters
    .filter((c) => c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
    .slice(0, 25);

  // Build a copy-number map so duplicate names show as "Name #1", "Name #2" etc.
  const countMap = new Map<string, number>();
  const named = new Map<string, number>();
  for (const c of filtered) {
    named.set(c.name, (named.get(c.name) ?? 0) + 1);
  }

  await interaction.respond(
    filtered.map((c) => {
      const isDupe = (named.get(c.name) ?? 0) > 1;
      let label: string;
      if (isDupe) {
        const n = (countMap.get(c.name) ?? 0) + 1;
        countMap.set(c.name, n);
        label = `#${n} ${c.name} (⚡ ${c.power}, ${rarityDef(c.rarity).label})`;
      } else {
        label = `${c.name} (⚡ ${c.power}, ${rarityDef(c.rarity).label})`;
      }
      return { name: label, value: c.id };
    }),
  );
}

// ==============================================================================
//  Button Handlers
// ==============================================================================

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Letters+digits only (no spaces or punctuation) so spacing/punctuation
 *  variants match: "T.J. Dillashaw" == "TJ Dillashaw". */
function compactName(value: string): string {
  return normalizeName(value).replace(/ /g, "");
}

function nameAliases(card: FighterCard): { spaced: string[]; compact: string[] } {
  const spaced = new Set<string>();
  const compact = new Set<string>();
  const add = (v: string): void => {
    const s = normalizeName(v);
    spaced.add(s);
    if (s) compact.add(compactName(v));
  };

  add(card.name);
  // The name without any embedded nickname: 'Maurício "Shogun" Rua' -> 'Maurício Rua'
  const bare = card.name.replace(/\s*"[^"]*"\s*/g, " ").trim();
  add(bare);
  const words = bare.split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const last = words[words.length - 1] ?? "";

  // Nickname from the explicit field, or the quoted part of the name.
  const nickname = card.nickname ?? card.name.match(/"([^"]+)"/)?.[1];
  if (nickname) {
    add(nickname); // "Shogun"
    add(`${bare} ${nickname}`); // "Maurício Rua Shogun"
    if (last) add(`${nickname} ${last}`); // "Shogun Rua"
    if (first) {
      add(`${nickname} ${first}`); // "Shogun Maurício"
      add(`${nickname} ${first} ${last}`); // "Shogun Maurício Rua"
    }
  }

  return { spaced: [...spaced], compact: [...compact] };
}

export async function handleClaim(
  interaction: ButtonInteraction,
  fighterId: string,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`spawnnow:claim-modal:${fighterId}`)
    .setTitle("Name the Fighter")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Fighter's name")
        .setDescription("Type the full name of the fighter that just spawned.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("fighterName")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g. Jon Jones")
            .setRequired(true),
        ),
    );

  await interaction.showModal(modal);
}

export async function handleClaimModal(
  interaction: ModalSubmitInteraction,
  fighterId: string,
): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const nameInput = interaction.fields.fields.has("fighterName")
    ? interaction.fields.getTextInputValue("fighterName")
    : "";

  const cfg = await getGuildConfig(guildId);
  const entry = cfg.activeSpawns.find((e) => e.fighter.id === fighterId);
  if (!entry) {
    await interaction.reply({
      content: "That fighter has already been claimed or left the octagon.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const pending = entry.fighter;

  const input = normalizeName(nameInput);
  const aliases = nameAliases(pending);
  const matches =
    aliases.spaced.includes(input) || aliases.compact.includes(compactName(nameInput));
  if (!matches) {
    // Public so the whole server sees who guessed wrong.
    await interaction.reply({
      content: `❌ <@${userId}>, **"${nameInput.trim()}"** isn't right. Look at the spawn card and try again — you can hit Claim again!`,
    });
    return;
  }

  if (claimLock.has(fighterId)) {
    await interaction.reply({
      content: "Someone else is already claiming this fighter!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  claimLock.add(fighterId);

  try {
    // Remove the spawn and hand back the entry in a single atomic step. This used
    // to be a full-object write built from a snapshot read *before* the fighter was
    // awarded, so a spawn that landed in that window was silently reverted — which
    // put an already-caught fighter back on the board and let it be claimed twice.
    const claimed = await updateGuildConfig(guildId, (cfg) => {
      const index = cfg.activeSpawns.findIndex((e) => e.fighter.id === fighterId);
      if (index === -1) return null;
      return cfg.activeSpawns.splice(index, 1)[0] ?? null;
    });

    if (!claimed) {
      await interaction.reply({
        content: "That fighter has already been claimed or left the octagon.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const card = { ...claimed.fighter, ownerId: userId };
    await addCardToUser(userId, card);

    const rDef = rarityDef(card.rarity);
    if (rDef.catchReward > 0) {
      await addCoins(userId, rDef.catchReward);
    }

    // Public announcement of who caught the fighter
    await interaction.reply({
      content: `✅ <@${userId}> caught **${card.name}** (⚡ ${card.power})${rDef.catchReward > 0 ? ` and earned 🪙 ${rDef.catchReward} Coins!` : "!"}`,
    });

    if (claimed.messageId && interaction.channel && "messages" in interaction.channel) {
      try {
        const msg = await interaction.channel.messages
          .fetch(claimed.messageId)
          .catch(() => null);
        if (msg) {
          // Reveal the fighter now that someone caught them: the poster is
          // re-rendered with the name shown and the Catch button becomes Claimed.
          let posterBuffer: Buffer | null = null;
          try {
            posterBuffer = await renderSpawnPoster(card, { revealed: true });
          } catch (err) {
            logger.warn("Claimed poster render failed, editing panel without an image.", {
              guildId,
              error: err,
            });
          }
          const panel = buildClaimedPanel(card, Boolean(posterBuffer));
          await msg.edit({
            attachments: [],
            files: posterBuffer
              ? [{ attachment: posterBuffer, name: "spawn.png" }]
              : undefined,
            components: [panel],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      } catch (err) {
        logger.warn("Could not edit spawn message after claim.", { guildId, error: err });
      }
    }

    logger.info("Fighter claimed via name guess.", {
      fighterId: card.id,
      name: card.name,
      userId,
    });
  } finally {
    claimLock.delete(fighterId);
  }
}

export async function handleViewButton(
  interaction: ButtonInteraction,
  fighterId: string,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const cards = await getInventory(userId);
  const card = cards.find((c) => c.id === fighterId);

  if (!card) {
    await interaction.editReply({ content: "You don't own a fighter with that ID." });
    return;
  }

  const listings = await getAllListings();
  const isListed = listings.some((l) => l.fighterId === card.id);
  const panel = buildFighterPanel(card, interaction.user.displayName, !isListed);

  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

export async function handleListButton(
  interaction: ButtonInteraction,
  fighterId: string,
): Promise<void> {
  const userId = interaction.user.id;

  const cards = await getInventory(userId);
  const card = cards.find((c) => c.id === fighterId);
  if (!card) {
    await interaction.reply({
      content: "You don't own a fighter with that ID.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const listings = await getAllListings();
  if (listings.some((l) => l.fighterId === fighterId)) {
    await interaction.reply({
      content: "This fighter is already listed on the market.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`list:list-modal:${fighterId}`)
    .setTitle("List on Market")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Price (coins)")
        .setDescription(`Listing ${card.name} (⚡ ${card.power})`)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("price")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Enter a price (minimum 1 coin)")
            .setRequired(true),
        ),
    );

  await interaction.showModal(modal);
}

export async function handleBuyConfirm(
  interaction: ButtonInteraction,
  listingId: string,
): Promise<void> {
  const listing = (await getAllListings()).find((l) => l.id === listingId);
  if (!listing) {
    await interaction.reply({
      content: "This listing no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (listing.sellerId === interaction.user.id) {
    await interaction.reply({
      content: "You can't buy your own fighter!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const profile = await getProfile(interaction.user.id);
  if (profile.coins < listing.price) {
    await interaction.reply({
      content: `You need 🪙 **${listing.price.toLocaleString()}** Coins but only have 🪙 **${profile.coins.toLocaleString()}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`market:buy-confirm:${listingId}`)
      .setLabel(`Yes — Pay 🪙 ${listing.price.toLocaleString()}`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`market:buy-cancel:${listingId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content: `Buy **${listing.fighterId}** for 🪙 **${listing.price.toLocaleString()}** Coins?`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleBuyExecute(
  interaction: ButtonInteraction,
  listingId: string,
): Promise<void> {
  await interaction.deferUpdate();

  const result = await buyFromMarket(listingId, interaction.user.id);
  if (!result) {
    await interaction.editReply({
      content: "Could not complete the purchase. The listing may have been sold or your coins are insufficient.",
    });
    return;
  }

  await interaction.editReply({
    content: `✅ Purchase complete! You paid 🪙 **${result.price.toLocaleString()}** Coins.`,
  });
}

export async function handleBuyCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();
  await interaction.editReply({ content: "Purchase cancelled." });
}

export async function handleMarketButton(
  interaction: ButtonInteraction,
  page: number,
): Promise<void> {
  const listings = await getAllListings();
  const totalPages = Math.max(1, Math.ceil(listings.length / FIGHTERS_PER_MARKET_PAGE));
  const safePage = Math.min(page, totalPages - 1);

  const pageListings = listings.slice(
    safePage * FIGHTERS_PER_MARKET_PAGE,
    (safePage + 1) * FIGHTERS_PER_MARKET_PAGE,
  );

  const rows: MarketRow[] = [];
  for (const listing of pageListings) {
    const sellerInv = await getInventory(listing.sellerId);
    const card = sellerInv.find((c) => c.id === listing.fighterId);
    if (card) rows.push({ listing, card });
  }

  const panel = buildMarketPanel(rows, safePage, totalPages);

  await interaction.deferUpdate();
  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
}

export async function handleInventoryButton(
  interaction: ButtonInteraction,
  page: number,
): Promise<void> {
  const userId = interaction.user.id;
  const profile = await getProfile(userId);
  const allCards = await getInventory(userId);
  const totalPages = Math.max(1, Math.ceil(allCards.length / FIGHTERS_PER_INV_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageCards = allCards.slice(
    safePage * FIGHTERS_PER_INV_PAGE,
    (safePage + 1) * FIGHTERS_PER_INV_PAGE,
  );

  const photoUrls: Record<string, string | null> = {};
  for (const card of pageCards) {
    try {
      photoUrls[card.id] = await getFighterPhotoUrl(card.name);
    } catch {
      photoUrls[card.id] = null;
    }
  }

  const panel = buildInventoryPanel(profile, pageCards, safePage, totalPages, photoUrls);

  await interaction.deferUpdate();
  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

export async function handleTradeAccept(
  interaction: ButtonInteraction,
  tradeId: string,
): Promise<void> {
  const trade = await getTrade(tradeId);
  if (!trade || trade.status !== "pending") {
    await interaction.reply({
      content: "This trade is no longer active.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.user.id !== trade.targetId) {
    await interaction.reply({
      content: "Only the trade target can accept this offer.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  if (trade.offerFighterId) {
    const offererCards = await getInventory(trade.offererId);
    if (!offererCards.some((c) => c.id === trade.offerFighterId && c.ownerId === trade.offererId)) {
      await interaction.editReply({
        components: [
          buildTradeResultPanel("❌ Trade Failed", ["The offerer no longer owns their fighter."], 0xe74c3c),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      await saveTrade({ ...trade, status: "declined" });
      return;
    }
  }

  if (trade.wantFighterId) {
    const targetCards = await getInventory(trade.targetId);
    if (!targetCards.some((c) => c.id === trade.wantFighterId && c.ownerId === trade.targetId)) {
      await interaction.editReply({
        components: [
          buildTradeResultPanel("❌ Trade Failed", ["The target no longer owns the requested fighter."], 0xe74c3c),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      await saveTrade({ ...trade, status: "declined" });
      return;
    }
  }

  if (trade.offerCoins > 0) {
    const offererProfile = await getProfile(trade.offererId);
    if (offererProfile.coins < trade.offerCoins) {
      await interaction.editReply({
        components: [
          buildTradeResultPanel("❌ Trade Failed", ["The offerer doesn't have enough Coins."], 0xe74c3c),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      await saveTrade({ ...trade, status: "declined" });
      return;
    }
  }

  if (trade.offerFighterId) {
    await moveCard(trade.offererId, trade.targetId, trade.offerFighterId);
  }
  if (trade.wantFighterId) {
    await moveCard(trade.targetId, trade.offererId, trade.wantFighterId);
  }
  if (trade.offerCoins > 0) {
    await trySpendCoins(trade.offererId, trade.offerCoins);
    await addCoins(trade.targetId, trade.offerCoins);
  }

  trade.status = "completed";
  await saveTrade(trade);

  await interaction.editReply({
    components: [
      buildTradeResultPanel(
        "✅ Trade Completed!",
        [
          `The fighters have swapped corners.`,
          trade.offerCoins > 0 ? `🪙 **${trade.offerCoins.toLocaleString()}** Coins transferred.` : "",
        ].filter(Boolean),
        0x2ecc71,
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function handleTradeDecline(
  interaction: ButtonInteraction,
  tradeId: string,
): Promise<void> {
  const trade = await getTrade(tradeId);
  if (!trade || trade.status !== "pending") {
    await interaction.reply({
      content: "This trade is no longer active.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.user.id !== trade.targetId) {
    await interaction.reply({
      content: "Only the trade target can decline this offer.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  trade.status = "declined";
  await saveTrade(trade);

  await interaction.editReply({
    components: [
      buildTradeResultPanel("🚫 Trade Declined", ["The target declined the trade offer."], 0xe74c3c),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function handleTradeCancel(
  interaction: ButtonInteraction,
  tradeId: string,
): Promise<void> {
  const trade = await getTrade(tradeId);
  if (!trade || trade.status !== "pending") {
    await interaction.reply({
      content: "This trade is no longer active.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.user.id !== trade.offererId) {
    await interaction.reply({
      content: "Only the offerer can cancel this trade.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  trade.status = "cancelled";
  await saveTrade(trade);

  await interaction.editReply({
    components: [
      buildTradeResultPanel("🚫 Trade Cancelled", ["The offerer cancelled the trade."], 0x95a5a6),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ==============================================================================
//  Modal Handlers
// ==============================================================================

export async function handleSetupModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await isGuildAdmin(interaction))) {
    await interaction.editReply({
      content: "You need **Manage Server** permission to do that.",
    });
    return;
  }

  const channel = interaction.fields.getSelectedChannels("channel", true).first();
  const enabled = interaction.fields.getCheckbox("enabled");

  // Patch the freshest config so reconfiguring the arena never wipes the fighters
  // that are currently live in the channel.
  await updateGuildConfig(interaction.guildId!, (cfg) => {
    cfg.channelId = channel?.id;
    cfg.intervalMinutes = 30;
    cfg.enabled = enabled;
  });

  await interaction.editReply({
    content: `✅ Arena configured!\nChannel: ${channel ? `<#${channel.id}>` : "—"}\nInterval: **30 min**\nSpawns: **${enabled ? "ON" : "OFF"}**`,
  });
}

export async function handleListModal(
  interaction: ModalSubmitInteraction,
  fighterId: string,
): Promise<void> {
  const priceStr = interaction.fields.fields.has("price")
    ? interaction.fields.getTextInputValue("price")
    : "0";
  const price = Math.max(1, parseInt(priceStr, 10) || 0);
  if (price < 1) {
    await interaction.reply({
      content: "Price must be at least 1 coin.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;

  const cards = await getInventory(userId);
  const card = cards.find((c) => c.id === fighterId);
  if (!card) {
    await interaction.reply({
      content: "You no longer own that fighter.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const result = await listOnMarket(userId, fighterId, price);
  if (!result) {
    await interaction.reply({
      content: "Could not list the fighter. They may already be on the market.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: `✅ **${card.name}** (⚡ ${card.power}) listed for 🪙 **${price.toLocaleString()}** Coins!`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleTradeModal(
  interaction: ModalSubmitInteraction,
  targetId: string,
): Promise<void> {
  const userId = interaction.user.id;

  const offerFighterId = interaction.fields.fields.has("offerFighter")
    ? interaction.fields.getStringSelectValues("offerFighter")[0] ?? undefined
    : undefined;
  const wantFighterId = interaction.fields.fields.has("wantFighter")
    ? interaction.fields.getStringSelectValues("wantFighter")[0] ?? undefined
    : undefined;
  const coinsStr = interaction.fields.fields.has("coins")
    ? interaction.fields.getTextInputValue("coins")
    : "0";
  const offerCoins = Math.max(0, parseInt(coinsStr, 10) || 0);

  if (!offerFighterId && offerCoins < 1) {
    await interaction.reply({
      content: "You must offer a fighter, coins, or both.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!wantFighterId) {
    await interaction.reply({
      content: "You must select a fighter you want.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (offerFighterId) {
    const myCards = await getInventory(userId);
    if (!myCards.some((c) => c.id === offerFighterId && c.ownerId === userId)) {
      await interaction.reply({
        content: "You no longer own the fighter you offered.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const targetCards = await getInventory(targetId);
  if (!targetCards.some((c) => c.id === wantFighterId && c.ownerId === targetId)) {
    await interaction.reply({
      content: "The target user no longer owns the fighter you want.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (offerCoins > 0) {
    const profile = await getProfile(userId);
    if (profile.coins < offerCoins) {
      await interaction.reply({
        content: `You only have 🪙 **${profile.coins.toLocaleString()}** but offered 🪙 **${offerCoins.toLocaleString()}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const tradeId = Math.random().toString(36).slice(2, 10);
  const proposal: TradeProposal = {
    id: tradeId,
    offererId: userId,
    targetId,
    offerFighterId,
    offerCoins,
    wantFighterId,
    status: "pending",
    createdAt: Date.now(),
    channelId: interaction.channelId!,
  };

  await createTrade(proposal);

  const myCards = await getInventory(userId);
  const offerCard = offerFighterId ? myCards.find((c) => c.id === offerFighterId) : undefined;

  const panel = buildTradePanel(
    proposal,
    memberName(interaction),
    (await interaction.client.users.fetch(targetId)).displayName,
    offerCard,
    targetCards.find((c) => c.id === wantFighterId),
    // Ping the target inside the Components V2 panel — a V2 message cannot
    // carry a legacy `content` field.
    `<@${targetId}>`,
  );

  const channel = interaction.channel;
  if (!channel?.isSendable()) {
    await interaction.reply({
      content: "This command must be used in a server channel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let vsBuffer: Buffer | null = null;
  const wantCard = targetCards.find((c) => c.id === wantFighterId);
  try {
    if (offerCard && wantCard) {
      vsBuffer = await renderTradePoster(offerCard, wantCard);
    }
  } catch (err) {
    logger.warn("Trade poster render failed, sending text-only.", {
      tradeId,
      error: err,
    });
  }

  if (vsBuffer) {
    panel.addMediaGalleryComponents((gallery) =>
      gallery.addItems({ media: { url: "attachment://trade.png" } }),
    );
  }

  const msg = await channel.send({
    files: vsBuffer ? [{ attachment: vsBuffer, name: "trade.png" }] : undefined,
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [targetId] },
  });

  proposal.messageId = msg.id;
  await saveTrade(proposal);

  await interaction.reply({
    content: "✅ Trade proposed!",
    flags: MessageFlags.Ephemeral,
  });
}
