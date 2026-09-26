import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { getClient } from "../bot/client.js";
import { loadConfig } from "../config.js";
import { getAllFighters, rarityDef } from "../features/mma/data.js";
import { spawnSpecific } from "../features/mma/spawner.js";
import { getGuildConfig } from "../features/mma/stores.js";

function isBotOwner(userId: string): boolean {
  return loadConfig().ownerIds.includes(userId);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("spawn")
    .setDescription("Spawn a specific fighter. (Bot owner)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName("fighter")
        .setDescription("The fighter to spawn.")
        .setAutocomplete(true)
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isBotOwner(interaction.user.id)) {
      await interaction.reply({
        content: "This command is restricted to the bot owner.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const fighterName = interaction.options.getString("fighter", true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const error = await spawnSpecific(getClient(), interaction.guildId!, fighterName);
    if (error) {
      await interaction.editReply({ content: error });
      return;
    }

    const cfg = await getGuildConfig(interaction.guildId!);
    await interaction.editReply({
      content: `⚡ **${fighterName}** has entered the octagon in <#${cfg.channelId}>!`,
    });
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!isBotOwner(interaction.user.id)) {
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
        name: `${f.name} (⚡ ${f.power} · ${rarityDef(f.rarity).label})`,
        value: f.name,
      })),
    );
  },
};

export default command;
