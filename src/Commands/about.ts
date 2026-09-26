import {
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { CARD_FOOTER } from "../features/mma/card.js";

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("about")
    .setDescription("About this bot.")
    .setContexts(InteractionContextType.Guild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const panel = new ContainerBuilder()
      .setAccentColor(0xf3743f)
      .addTextDisplayComponents((text) =>
        text.setContent(
          "# 🥋 MMAdex\nCollect, claim, and trade real mixed-martial-arts stars as digital cards.",
        ),
      )
      .addTextDisplayComponents((text) =>
        text.setContent(
          "**⚡ Spawns** — mystery fighters appear with their name hidden. Claim one by typing their name first.\n**🎒 Packs** — buy Common/Rare packs and open Daily/Weekly rewards.\n**💱 Market** — buy, sell, and trade fighters with other fans.\n**🏆 Leaderboard** — climb the ranks.",
        ),
      )
      .addTextDisplayComponents((text) =>
        text.setContent(`Built with VybeBot.ai\n${CARD_FOOTER}`),
      );

    await interaction.reply({
      components: [panel],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
  },
};

export default command;
