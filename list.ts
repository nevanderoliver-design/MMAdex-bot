import {
  InteractionContextType,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import {
  handleListCommand,
  handleListButton,
  handleListModal,
  runFighterAutocomplete,
} from "../features/mma/commandShared.js";

function parse(customId: string): string[] {
  const parts = customId.split(":");
  return parts[0] === "list" ? parts.slice(1) : [];
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("List a fighter on the market.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName("fighter")
        .setDescription("The fighter to sell.")
        .setAutocomplete(true)
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("price")
        .setDescription("Price in coins (minimum 1).")
        .setMinValue(1)
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleListCommand(interaction);
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await runFighterAutocomplete(interaction, "list");
  },

  async button(interaction: ButtonInteraction): Promise<void> {
    // customId: "list:<cardId>" — from the fighter card panel
    const [cardId] = parse(interaction.customId);
    if (cardId) {
      await handleListButton(interaction, cardId);
    }
  },

  async modal(interaction: ModalSubmitInteraction): Promise<void> {
    const [action, ...rest] = parse(interaction.customId);
    if (action === "list-modal") {
      await handleListModal(interaction, rest[0]!);
    }
  },
};

export default command;
