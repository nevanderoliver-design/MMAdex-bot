import {
  InteractionContextType,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { handleHelp } from "../features/mma/commandShared.js";

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show the MMA bot overview and commands.")
    .setContexts(InteractionContextType.Guild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleHelp(interaction);
  },
};

export default command;
