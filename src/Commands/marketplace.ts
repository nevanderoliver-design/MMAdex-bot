import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import {
  buildMarketPanel,
  buildPackShopPanel,
  CARD_FOOTER,
  type LastPackOpen,
  type MarketRow,
} from "../features/mma/card.js";
import { FIGHTERS_PER_MARKET_PAGE } from "../features/mma/commandShared.js";
import { packDef, openPack } from "../features/mma/packs.js";
import {
  addCardToUser,
  addPacks,
  buyFromMarket,
  getAllListings,
  getInventory,
  getProfile,
  trySpendCoins,
  tryUsePack,
} from "../features/mma/stores.js";
import type { PackType } from "../features/mma/types.js";

function parse(customId: string): string[] {
  const parts = customId.split(":");
  return parts[0] === "marketplace" ? parts.slice(1) : [];
}

async function sendPackPanel(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  lastOpen?: LastPackOpen,
): Promise<void> {
  const profile = await getProfile(interaction.user.id);
  const panel = buildPackShopPanel(profile, lastOpen);
  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
}

async function sendFightersPanel(
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
    if (card) rows.push({ listing, card });
  }

  const panel = buildMarketPanel(rows, safePage, totalPages, "marketplace");
  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("marketplace")
    .setDescription("Buy fighters and packs.")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("packs")
        .setDescription("Open the pack shop — buy and open packs."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("fighters")
        .setDescription("Browse and buy fighters on the fighter marketplace."),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === "packs") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await sendPackPanel(interaction);
      return;
    }

    // fighters
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await sendFightersPanel(interaction, 0);
  },

  async button(interaction: ButtonInteraction): Promise<void> {
    const [action, ...rest] = parse(interaction.customId);
    switch (action) {
      case "pbuy": {
        await interaction.deferUpdate();
        const type = rest[0] as PackType;
        const def = packDef(type);
        const ok = await trySpendCoins(interaction.user.id, def.price);
        if (!ok) {
          await interaction.followUp({
            content: `You don't have enough **Coins** for a ${def.emoji} ${def.label} (needs 🪙 **${def.price.toLocaleString()}**).`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await addPacks(interaction.user.id, type, 1);
          await interaction.followUp({
            content: `✅ Bought a ${def.emoji} **${def.label}** for 🪙 **${def.price.toLocaleString()}** Coins. Open it from the shop above!\n${CARD_FOOTER}`,
            flags: MessageFlags.Ephemeral,
          });
        }
        await sendPackPanel(interaction);
        return;
      }

      case "popen": {
        await interaction.deferUpdate();
        const type = rest[0] as PackType;
        const ok = await tryUsePack(interaction.user.id, type);
        if (!ok) {
          await interaction.followUp({
            content: `You don't own a ${packDef(type).emoji} **${packDef(type).label}** to open.`,
            flags: MessageFlags.Ephemeral,
          });
          await sendPackPanel(interaction);
          return;
        }
        const { card, pack } = openPack(type, interaction.user.id);
        await addCardToUser(interaction.user.id, card);
        await interaction.followUp({
          content: `🔓 You opened a ${pack.emoji} **${pack.label}** and pulled **${card.name}**! ⚡ Power **${card.power}** (${card.division}).\n${CARD_FOOTER}`,
          flags: MessageFlags.Ephemeral,
        });
        await sendPackPanel(interaction, { pack: type, card });
        return;
      }

      case "page": {
        await interaction.deferUpdate();
        await sendFightersPanel(interaction, Number(rest[0] ?? 0));
        return;
      }

      case "buy": {
        await interaction.deferUpdate();
        const listingId = rest[0]!;
        const listing = await buyFromMarket(listingId, interaction.user.id);
        if (listing) {
          const bought = (await getInventory(interaction.user.id)).find(
            (c) => c.id === listing.fighterId,
          );
          await interaction.followUp({
            content: bought
              ? `✅ You bought **${bought.name}** (⚡ ${bought.power}) for 🪙 **${listing.price.toLocaleString()}** Coins!\n${CARD_FOOTER}`
              : `✅ Purchase complete for 🪙 **${listing.price.toLocaleString()}** Coins.\n${CARD_FOOTER}`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: "That fighter is no longer available (already sold or you can't buy it).",
            flags: MessageFlags.Ephemeral,
          });
        }
        await sendFightersPanel(interaction, 0);
        return;
      }

      default:
        return;
    }
  },
};

export default command;
