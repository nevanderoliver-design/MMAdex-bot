import {
  InteractionContextType,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import {
  handleGiveCoin,
  handleGiveFighter,
  runFighterAutocomplete,
} from "../features/mma/commandShared.js";

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("give")
    .setDescription("Give coins or a fighter card to another player.")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("coin")
        .setDescription("Give coins to another player.")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The player to give coins to.")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("How many coins to give.")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("fighter")
        .setDescription("Give a fighter card to another player.")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("The player to give the fighter to.")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("fighter")
            .setDescription("The fighter to give.")
            .setAutocomplete(true)
            .setRequired(true),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === "coin") {
      await handleGiveCoin(interaction);
    } else if (sub === "fighter") {
      await handleGiveFighter(interaction);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await runFighterAutocomplete(interaction, "give");
  },
};

export default command;
