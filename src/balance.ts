import {
  InteractionContextType,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { handleBalance } from "../features/mma/commandShared.js";

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your coin balance and stats.")
    .setContexts(InteractionContextType.Guild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleBalance(interaction);
  },
};

export default command;
