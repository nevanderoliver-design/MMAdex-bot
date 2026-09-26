import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import {
  handleSetup,
  handleSetupModal,
  isGuildAdmin,
} from "../features/mma/commandShared.js";

function parse(customId: string): string[] {
  const parts = customId.split(":");
  return parts[0] === "setup" ? parts.slice(1) : [];
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set up your server's spawn channel. (Server admins)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (await isGuildAdmin(interaction)) {
      await handleSetup(interaction);
    } else {
      await interaction.reply({
        content: "You need **Manage Server** permission to configure the arena.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  async modal(interaction: ModalSubmitInteraction): Promise<void> {
    const [action] = parse(interaction.customId);
    if (action === "config") {
      await handleSetupModal(interaction);
    }
  },
};

export default command;
