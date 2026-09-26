import {
  InteractionContextType,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import {
  handleInventory,
  handleInventoryButton,
} from "../features/mma/commandShared.js";

function parse(customId: string): string[] {
  const parts = customId.split(":");
  return parts[0] === "inventory" ? parts.slice(1) : [];
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Browse your collection of fighters.")
    .setContexts(InteractionContextType.Guild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleInventory(interaction, 0);
  },

  async button(interaction: ButtonInteraction): Promise<void> {
    const [action, , pageStr] = parse(interaction.customId);
    if (action === "page") {
      await handleInventoryButton(interaction, Number(pageStr ?? 0));
    }
  },
};

export default command;
