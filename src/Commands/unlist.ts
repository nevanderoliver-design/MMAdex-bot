import {
  InteractionContextType,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import {
  handleUnlistCommand,
  runFighterAutocomplete,
} from "../features/mma/commandShared.js";

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unlist")
    .setDescription("Remove a fighter listing from the market.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName("fighter")
        .setDescription("The fighter to unlist.")
        .setAutocomplete(true)
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleUnlistCommand(interaction);
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await runFighterAutocomplete(interaction, "unlist");
  },
};

export default command;
