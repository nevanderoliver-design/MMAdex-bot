import {
  InteractionContextType,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import {
  handleView,
  handleViewButton,
  runFighterAutocomplete,
} from "../features/mma/commandShared.js";

function parse(customId: string): string[] {
  const parts = customId.split(":");
  return parts[0] === "view" ? parts.slice(1) : [];
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("view")
    .setDescription("Inspect a fighter card.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName("fighter")
        .setDescription("The fighter to view.")
        .setAutocomplete(true)
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleView(interaction);
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await runFighterAutocomplete(interaction, "view");
  },

  async button(interaction: ButtonInteraction): Promise<void> {
    // customId: "view:<cardId>"
    const [cardId] = parse(interaction.customId);
    if (cardId) {
      await handleViewButton(interaction, cardId);
    }
  },
};

export default command;
