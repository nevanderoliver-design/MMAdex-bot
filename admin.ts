import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { loadConfig } from "../config.js";
import { getAllFighters, mintFighterByName, rarityDef } from "../features/mma/data.js";
import { addCoins, addCardToUser } from "../features/mma/stores.js";
import { logger } from "../utils/logger.js";

// ── Owner guard ─────────────────────────────────────────────────────────────────

const OWNER_IDS = loadConfig().ownerIds;

function isOwner(userId: string): boolean {
  return OWNER_IDS.includes(userId);
}

function ownerOnly(): string {
  return `This command is restricted to the bot owner.`;
}

// ── Command definition ─────────────────────────────────────────────────────────

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Owner-only administration commands.")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ── give group ──────────────────────────────────────────────────────────
    .addSubcommandGroup((group) =>
      group
        .setName("give")
        .setDescription("Give resources to another player.")

        .addSubcommand((sub) =>
          sub
            .setName("fighter")
            .setDescription("Give a specific fighter to a user.")
            .addUserOption((opt) =>
              opt
                .setName("user")
                .setDescription("The recipient.")
                .setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName("fighter")
                .setDescription("The fighter to give.")
                .setAutocomplete(true)
                .setRequired(true),
            ),
        )

        .addSubcommand((sub) =>
          sub
            .setName("coin")
            .setDescription("Give coins to a user.")
            .addUserOption((opt) =>
              opt
                .setName("user")
                .setDescription("The recipient.")
                .setRequired(true),
            )
            .addIntegerOption((opt) =>
              opt
                .setName("amount")
                .setDescription("Amount of coins to give.")
                .setMinValue(1)
                .setRequired(true),
            ),
        ),
    ) as SlashCommandBuilder,

  // ── Execute ──────────────────────────────────────────────────────────────────
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        content: ownerOnly(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group === "give" && sub === "fighter") {
      return handleGiveFighter(interaction);
    }
    if (group === "give" && sub === "coin") {
      return handleGiveCoin(interaction);
    }

    await interaction.reply({
      content: "Unknown subcommand.",
      flags: MessageFlags.Ephemeral,
    });
  },

  // ── Autocomplete ─────────────────────────────────────────────────────────────
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!isOwner(interaction.user.id)) {
      await interaction.respond([]);
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    // Only offer autocomplete for `give fighter`
    if (group !== "give" || sub !== "fighter") {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused(true);
    const query = focused.value.toLowerCase();

    const fighters = getAllFighters();
    const filtered = fighters
      .filter((f) => f.name.toLowerCase().includes(query))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((f) => ({
        name: `${f.name} (⚡ ${f.power}, ${rarityDef(f.rarity).label} · ${f.division})`,
        value: f.name,
      })),
    );
  },
};

export default command;

// ── Handlers ────────────────────────────────────────────────────────────────────

async function handleGiveFighter(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const targetUser = interaction.options.getUser("user", true);
  const fighterName = interaction.options.getString("fighter", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const card = mintFighterByName(fighterName, targetUser.id);
  if (!card) {
    await interaction.editReply({
      content: `Fighter **${fighterName}** not found in the database.`,
    });
    return;
  }

  await addCardToUser(targetUser.id, card);

  logger.info("Admin gave fighter.", {
    adminId: interaction.user.id,
    targetId: targetUser.id,
    fighterId: card.id,
    name: card.name,
  });

  await interaction.editReply({
    content: `✅ **${card.name}** (⚡ ${card.power} · ${rarityDef(card.rarity).label}) given to ${targetUser.toString()}.`,
  });
}

async function handleGiveCoin(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const targetUser = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const newBalance = await addCoins(targetUser.id, amount);

  logger.info("Admin gave coins.", {
    adminId: interaction.user.id,
    targetId: targetUser.id,
    amount,
    newBalance,
  });

  await interaction.editReply({
    content: `✅ 🪙 **${amount.toLocaleString()}** Coin${amount > 1 ? "s" : ""} given to ${targetUser.toString()}. They now have 🪙 **${newBalance.toLocaleString()}** Coin${newBalance > 1 ? "s" : ""}.`,
  });
}