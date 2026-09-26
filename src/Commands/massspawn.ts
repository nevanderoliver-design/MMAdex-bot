import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { getClient } from "../bot/client.js";
import { loadConfig } from "../config.js";
import { massSpawn } from "../features/mma/spawner.js";
import { getGuildConfig } from "../features/mma/stores.js";

const MASS_SPAWN_COUNT = 5;

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("massspawn")
    .setDescription(`Spawn ${MASS_SPAWN_COUNT} fighters at once. (Bot owner)`)
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!loadConfig().ownerIds.includes(interaction.user.id)) {
      await interaction.reply({
        content: "This command is restricted to the bot owner.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const error = await massSpawn(getClient(), interaction.guildId!, MASS_SPAWN_COUNT);
    if (error) {
      await interaction.editReply({ content: error });
      return;
    }

    const cfg = await getGuildConfig(interaction.guildId!);
    await interaction.editReply({
      content: `⚡ **${MASS_SPAWN_COUNT} fighters** have entered the octagon in <#${cfg.channelId}>! Claim them before they leave.`,
    });
  },
};

export default command;
