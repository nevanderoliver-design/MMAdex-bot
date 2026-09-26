import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  StringSelectMenuBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { rarityDef } from "./data.js";
import { packDef, packOddsText } from "./packs.js";
import type { LeaderboardEntry, LeaderboardMetric } from "./stores.js";
import type {
  FighterCard,
  MarketListing,
  PackType,
  TradeProposal,
  UserProfile,
} from "./types.js";

export const CARD_FOOTER = "Built with VybeBot.ai | MMA Card Game";

export interface MarketRow {
  listing: MarketListing;
  card: FighterCard;
}

function displayName(card: FighterCard): string {
  return card.nickname ? `${card.name} "${card.nickname}"` : card.name;
}

function divider(): string {
  return "─".repeat(18);
}

function paginationRow(
  command: string,
  page: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${command}:page:${page - 1}`)
      .setLabel("◀ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${command}:page:${page + 1}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages - 1),
  );
}

/** The full fighter card used for /view and inside inventories. */
export function buildFighterPanel(
  card: FighterCard,
  ownerLabel: string,
  canList: boolean,
): ContainerBuilder {
  const rarity = rarityDef(card.rarity);

  const panel = new ContainerBuilder()
    .setAccentColor(rarity.color)
    .addTextDisplayComponents((text) =>
      text.setContent(
        `# ${rarity.emoji} ${displayName(card)}\n**Division:** ${card.division} · **Power:** ⚡ ${card.power}`,
      ),
    )
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((text) =>
          text.setContent(
            `**Rarity:** ${rarity.label}\n**Owner:** ${ownerLabel}\n**Card ID:** \`${card.id}\``,
          ),
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId(`list:${card.id}`)
            .setLabel("List on Market")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canList),
        ),
    )
    .addTextDisplayComponents((text) =>
      text.setContent(
        `### ⚡ Power\n**${card.power}/100**\n${divider()}\n${CARD_FOOTER}`,
      ),
    );

  return panel;
}

/**
 * Spawn announcement message — bare by design. The masked 1:1 fighter photo is
 * the clue, so the message shows almost nothing else: the photo and a single
 * Catch button. `hasPhoto` decides whether the poster attachment is shown; if a
 * poster failed to render we still expose the Catch button rather than a broken
 * image.
 */
export function buildSpawnPanel(
  card: FighterCard,
  hasPhoto: boolean,
): ContainerBuilder {
  const panel = new ContainerBuilder()
    .setAccentColor(rarityDef(card.rarity).color)
    .addTextDisplayComponents((text) =>
      text.setContent(
        `## 🔥 A fighter has spawned!\nName them to bring them into your corner.`,
      ),
    );
  if (hasPhoto) {
    panel.addMediaGalleryComponents((gallery) =>
      gallery.addItems({ media: { url: "attachment://spawn.png" } }),
    );
  }
  panel.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`spawnnow:claim:${card.id}`)
        .setLabel("Catch")
        .setStyle(ButtonStyle.Primary),
    ),
  );
  return panel;
}

/**
 * Edit shown in the spawn message after someone claims. Matches the bare spawn
 * layout: the photo plus a disabled Claimed button. The poster is re-rendered
 * with the fighter's name revealed once they're caught.
 */
export function buildClaimedPanel(
  card: FighterCard,
  hasPhoto: boolean,
): ContainerBuilder {
  const panel = new ContainerBuilder().setAccentColor(
    rarityDef(card.rarity).color,
  );
  if (hasPhoto) {
    panel.addMediaGalleryComponents((gallery) =>
      gallery.addItems({ media: { url: "attachment://spawn.png" } }),
    );
  }
  panel.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("spawnnow:claim-closed")
        .setLabel("Claimed")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    ),
  );
  return panel;
}

/** Expired spawn edit — reveal the name now that the round is over. */
export function buildExpiredPanel(card: FighterCard): ContainerBuilder {
  const rarity = rarityDef(card.rarity);
  return new ContainerBuilder()
    .setAccentColor(0x55555f)
    .addTextDisplayComponents((text) =>
      text.setContent(
        `# 💨 Gone…\nThe mystery fighter was **${displayName(card)}** (⚡ ${card.power}) — nobody named them in time.`,
      ),
    )
    .addTextDisplayComponents((text) => text.setContent(CARD_FOOTER));
}

/** Paginated inventory dashboard with fighter photo thumbnails when available. */
export function buildInventoryPanel(
  profile: UserProfile,
  cards: FighterCard[],
  page: number,
  totalPages: number,
  photoUrls?: Record<string, string | null | undefined>,
): ContainerBuilder {
  const panel = new ContainerBuilder()
    .setAccentColor(0xf3743f)
    .addTextDisplayComponents((text) =>
      text.setContent(
        `# 🎒 Your Roster\n**Coins:** 🪙 ${profile.coins.toLocaleString()} · **Fighters:** ${profile.caught} · **Page** ${page + 1}/${totalPages}`,
      ),
    );

  if (cards.length === 0) {
    panel.addTextDisplayComponents((text) =>
      text.setContent(
        "No fighters yet. Watch for **⚡ spawns** in the arena channel and hit Claim first!",
      ),
    );
  } else {
    for (const card of cards) {
      const rarity = rarityDef(card.rarity);
      const url = photoUrls?.[card.id];

      if (url) {
        // Photo available — show thumbnail + text
        panel.addSectionComponents((section) =>
          section
            .addTextDisplayComponents((text) =>
              text.setContent(
                `${rarity.emoji} **${displayName(card)}** — ⚡ **${card.power}**\n${card.division} · ${rarity.label} · \`${card.id}\``,
              ),
            )
            .setThumbnailAccessory((thumb) =>
              thumb
                .setURL(url)
                .setDescription(displayName(card)),
            ),
        );
      } else {
        // No photo — keep View Card button accessory
        panel.addSectionComponents((section) =>
          section
            .addTextDisplayComponents((text) =>
              text.setContent(
                `${rarity.emoji} **${displayName(card)}** — ⚡ **${card.power}**\n${card.division} · ${rarity.label} · \`${card.id}\``,
              ),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId(`view:${card.id}`)
                .setLabel("View Card")
                .setStyle(ButtonStyle.Secondary),
            ),
        );
      }
    }
  }

  if (totalPages > 1) {
    panel.addActionRowComponents(paginationRow("inventory", page, totalPages));
  }

  panel.addTextDisplayComponents((text) =>
    text.setContent(`${divider()}\n${CARD_FOOTER}`),
  );
  return panel;
}

/** Paginated market dashboard. */
export function buildMarketPanel(
  rows: MarketRow[],
  page: number,
  totalPages: number,
  command = "market",
): ContainerBuilder {
  const panel = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents((text) =>
      text.setContent(
        `# 🥊 Fighter Market\nDozens of fighters up for grabs — **Page** ${page + 1}/${totalPages}`,
      ),
    );

  if (rows.length === 0) {
    panel.addTextDisplayComponents((text) =>
      text.setContent(
        "The market is empty. Sell your fighters with `/list <card> <price>`.",
      ),
    );
  } else {
    for (const { listing, card } of rows) {
      const rarity = rarityDef(card.rarity);
      panel.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((text) =>
            text.setContent(
              `${rarity.emoji} **${displayName(card)}** — ⚡ **${card.power}**\n${card.division} · ${rarity.label}\nSeller: <@${listing.sellerId}>`,
            ),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId(`${command}:buy:${listing.id}`)
              .setLabel(`Buy · 🪙 ${listing.price.toLocaleString()}`)
              .setStyle(ButtonStyle.Success),
          ),
      );
    }
  }

  if (totalPages > 1) {
    panel.addActionRowComponents(paginationRow(command, page, totalPages));
  }

  panel.addTextDisplayComponents((text) =>
    text.setContent(`${divider()}\n${CARD_FOOTER}`),
  );
  return panel;
}

/** Trade proposal message posted in a channel. */
export function buildTradePanel(
  proposal: TradeProposal,
  offererLabel: string,
  targetLabel: string,
  offerCard: FighterCard | undefined,
  wantCard: FighterCard | undefined,
  targetMention?: string,
): ContainerBuilder {
  const offerText = offerCard
    ? `Fighter: **${displayName(offerCard)}** (⚡ ${offerCard.power})`
    : "no fighter";
  const coinText =
    proposal.offerCoins > 0
      ? ` + 🪙 **${proposal.offerCoins.toLocaleString()}**`
      : "";
  const wantText = wantCard
    ? `${displayName(wantCard)} (⚡ ${wantCard.power})`
    : "nothing";

  const panel = new ContainerBuilder().setAccentColor(0x3498db);

  // A Components V2 message cannot carry a `content` field, so a ping to the
  // target must be rendered as a text display inside the container instead.
  if (targetMention) {
    panel.addTextDisplayComponents((text) =>
      text.setContent(`${targetMention} — you have a trade offer!`),
    );
  }

  panel
    .addTextDisplayComponents((text) =>
      text.setContent(
        `# 🤝 Trade Offer\n**${offererLabel}** wants to trade with **${targetLabel}**`,
      ),
    )
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((text) =>
          text.setContent(
            `**Offering:** ${offerText}${coinText}\n**Asking for:** ${wantText}\n\n${targetLabel}, do you accept?`,
          ),
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId(`trade:accept:${proposal.id}`)
            .setLabel("Accept ✅")
            .setStyle(ButtonStyle.Success),
        ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade:decline:${proposal.id}`)
          .setLabel("Decline")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`trade:cancel:${proposal.id}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      ),
    )
    .addTextDisplayComponents((text) => text.setContent(CARD_FOOTER));

  return panel;
}

/** Trade outcome edit. */
export function buildTradeResultPanel(
  title: string,
  lines: string[],
  accent: number,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents((text) =>
      text.setContent(`# ${title}\n${lines.join("\n")}`),
    )
    .addTextDisplayComponents((text) => text.setContent(CARD_FOOTER));
}

/** Interface for the last pack a user opened (rendered on the shop panel). */
export interface LastPackOpen {
  pack: PackType;
  card: FighterCard;
}

/** Pack shop dashboard (Common/Rare purchasable, Daily/Weekly auto-granted). */
export function buildPackShopPanel(
  profile: UserProfile,
  lastOpen?: LastPackOpen,
): ContainerBuilder {
  const panel = new ContainerBuilder()
    .setAccentColor(0xe67e22)
    .addTextDisplayComponents((text) =>
      text.setContent(
        `# 🎒 Pack Shop\n**Coins:** 🪙 ${profile.coins.toLocaleString()} · **Packs owned:** 📦${profile.packs.common ?? 0} 🎁${profile.packs.rare ?? 0} 🌅${profile.packs.daily ?? 0} 📅${profile.packs.weekly ?? 0}`,
      ),
    );

  if (lastOpen) {
    const pack = packDef(lastOpen.pack);
    const card = lastOpen.card;
    const rarity = rarityDef(card.rarity);
    panel.addSectionComponents((section) =>
      section
        .addTextDisplayComponents((text) =>
          text.setContent(
            `# 🔓 Opened ${pack.emoji} ${pack.label}!\n${rarity.emoji} **${displayName(card)}** — ⚡ **${card.power}**\n${card.division} · ${rarity.label} · \`${card.id}\``,
          ),
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId(`view:${card.id}`)
            .setLabel("View Card")
            .setStyle(ButtonStyle.Secondary),
        ),
    );
  }

  const renderPack = (packId: PackType): void => {
    const pack = packDef(packId);
    const owned = profile.packs[packId] ?? 0;
    const odds = packOddsText(pack);
    const afford = profile.coins >= pack.price;

    panel.addSectionComponents((section) => {
      let builder = section.addTextDisplayComponents((text) => {
        const priceLine = pack.buyable
          ? `\n**Price:** 🪙 ${pack.price.toLocaleString()} Coins`
          : "\n**Source:** Auto-granted on a timer";
        return text.setContent(
          `${pack.emoji} **${pack.label}** — Owned: **${owned}**\n${odds}${priceLine}`,
        );
      });

      if (owned > 0) {
        builder = builder.setButtonAccessory((button) =>
          button
            .setCustomId(`marketplace:popen:${packId}`)
            .setLabel("🔓 Open")
            .setStyle(ButtonStyle.Success),
        );
      } else if (pack.buyable) {
        builder = builder.setButtonAccessory((button) =>
          button
            .setCustomId(`marketplace:pbuy:${packId}`)
            .setLabel(`Buy · 🪙 ${pack.price.toLocaleString()}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!afford),
        );
      } else {
        builder = builder.setButtonAccessory((button) =>
          button
            .setCustomId(`marketplace:popen:${packId}`)
            .setLabel(pack.emoji)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );
      }
      return builder;
    });
  };

  renderPack("common");
  renderPack("rare");
  renderPack("daily");
  renderPack("weekly");

  panel.addTextDisplayComponents((text) =>
    text.setContent(
      `${divider()}\nOpen a pack to reveal a fighter. Your Daily (global) and Weekly packs arrive automatically.\n${CARD_FOOTER}`,
    ),
  );
  return panel;
}

export interface LeaderboardDef {
  id: LeaderboardMetric;
  label: string;
  description: string;
}

export const LEADERBOARD_METRICS: LeaderboardDef[] = [
  { id: "cards", label: "Most Cards", description: "Largest fighter collection" },
  { id: "coins", label: "Most Coins", description: "Richest coin balance" },
  { id: "power", label: "Best Power", description: "Highest single fighter power" },
  { id: "caught", label: "Most Caught", description: "Most fighters claimed" },
  { id: "dupes", label: "Same Fighter", description: "Most copies of one fighter" },
];

function leaderboardMedal(index: number): string {
  return ["🥇", "🥈", "🥉"][index] ?? `#${index + 1}`;
}

function leaderboardValueText(metric: LeaderboardMetric, entry: LeaderboardEntry): string {
  switch (metric) {
    case "cards":
      return `${entry.value} card${entry.value === 1 ? "" : "s"}`;
    case "coins":
      return `🪙 ${entry.value.toLocaleString()} Coins`;
    case "power":
      return `⚡ ${entry.value}`;
    case "caught":
      return `${entry.value} caught`;
    case "dupes":
      return `${entry.value} × ${entry.label ?? "—"}`;
    default:
      return String(entry.value);
  }
}

/** Leaderboard dashboard with a metric picker. */
export function buildLeaderboardPanel(
  metric: LeaderboardMetric,
  entries: LeaderboardEntry[],
  names: Record<string, string>,
): ContainerBuilder {
  const def = LEADERBOARD_METRICS.find((m) => m.id === metric) ?? LEADERBOARD_METRICS[0]!;

  const lines: string[] = [];
  if (entries.length === 0) {
    lines.push("No players yet — catch some fighters to climb the board!");
  } else {
    entries.forEach((entry, i) => {
      const name = names[entry.userId] ?? `<@${entry.userId}>`;
      lines.push(`${leaderboardMedal(i)} **${name}** — ${leaderboardValueText(metric, entry)}`);
    });
  }

  const panel = new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents((text) =>
      text.setContent(`# 🏆 ${def.label}\n${lines.join("\n")}`),
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId("leaderboard:metric")
    .setPlaceholder("Change leaderboard")
    .addOptions(
      LEADERBOARD_METRICS.map((m) => ({
        label: m.label,
        value: m.id,
        description: m.description,
        default: m.id === metric,
      })),
    );

  panel.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
  );

  panel.addTextDisplayComponents((text) =>
    text.setContent(`${divider()}\n${CARD_FOOTER}`),
  );
  return panel;
}

/** Help panel for /help. */
export function buildHelpPanel(): ContainerBuilder {
  const lines = [
    "**⚡ Spawns** — mystery fighters enter the octagon with their **name hidden**. Hit Claim and type their name to win them.",
    "**`/inventory`** — browse your roster of fighters.",
    "**`/view <card>`** — inspect a fighter card.",
    "**`/list <card> <price>`** — sell a fighter on the market.",
    "**`/unlist <card>`** — pull a fighter off the market.",
    "**`/marketplace fighters`** — browse and buy fighters.",
    "**`/marketplace packs`** — buy and open packs.",
    "**`/trade @user`** — swap fighters (and coins) with another fan.",
    "**`/give coin @user <amount>`** — gift coins to another player.",
    "**`/give fighter @user <card>`** — gift a fighter card to another player.",
    "**`/balance`** — check your coin balance.",
    "**`/leaderboard`** — see the top players (most cards, coins, power, catches, same fighter).",
    "**`/about`** — info about the bot.",
    "**`/help`** — this panel.",
    "",
    "Admins: **`/setup`** and **`/spawnnow`** control the arena.",
    "",
    "Rarity order: 👑 Mythic > 🌟 Legendary > 🟣 Epic > 🔵 Rare",
    "Built with VybeBot.ai",
  ];
  return new ContainerBuilder()
    .setAccentColor(0xf3743f)
    .addTextDisplayComponents((text) =>
      text.setContent(`# 🥋 MMA Fighters\n${lines.join("\n")}`),
    );
}