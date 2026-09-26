import {
  InteractionContextType,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import {
  handleTrade,
  handleTradeModal,
  handleTradeAccept,
  handleTradeDecline,
  handleTradeCancel,
} from "../features/mma/commandShared.js";

function parse(customId: string): string[] {
  const parts = customId.split(":");
  return parts[0] === "trade" ? parts.slice(1) : [];
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Propose a trade with another user.")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The user you want to trade with.")
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleTrade(interaction);
  },

  async button(interaction: ButtonInteraction): Promise<void> {
    const [action, ...rest] = parse(interaction.customId);
    switch (action) {
      case "accept":
        return handleTradeAccept(interaction, rest[0]!);
      case "decline":
        return handleTradeDecline(interaction, rest[0]!);
      case "cancel":
        return handleTradeCancel(interaction, rest[0]!);
      default:
        return;
    }
  },

  async modal(interaction: ModalSubmitInteraction): Promise<void> {
    const [action, ...rest] = parse(interaction.customId);
    if (action === "trade-modal") {
      await handleTradeModal(interaction, rest[0]!);
    }
  },
};

export default command;
