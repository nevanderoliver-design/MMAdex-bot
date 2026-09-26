import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { loadConfig } from "../config.js";
import {
  handleSpawnNow,
  handleClaim,
  handleClaimModal,
} from "../features/mma/commandShared.js";

function parse(customId: string): string[] {
  const parts = customId.split(":");
  return parts[0] === "spawnnow" ? parts.slice(1) : [];
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("spawnnow")
    .setDescription("Force a fighter spawn immediately. (Bot owner)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (loadConfig().ownerIds.includes(interaction.user.id)) {
      await handleSpawnNow(interaction);
    } else {
      await interaction.reply({
        content: "This command is restricted to the bot owner.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  async button(interaction: ButtonInteraction): Promise<void> {
    const [action, ...rest] = parse(interaction.customId);
    if (!action) return;
    // The Claim button lives on spawn messages; route it through this command.
    if (action === "claim") {
      await handleClaim(interaction, rest[0]!);
    }
    // "claim-closed" is a disabled button — ignore it.
  },

  async modal(interaction: ModalSubmitInteraction): Promise<void> {
    const [action, ...rest] = parse(interaction.customId);
    if (action === "claim-modal") {
      await handleClaimModal(interaction, rest[0]!);
    }
  },
};

export default command;
