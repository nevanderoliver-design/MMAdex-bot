import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { buildLeaderboardPanel } from "../features/mma/card.js";
import {
  computeLeaderboard,
  type LeaderboardMetric,
} from "../features/mma/stores.js";

const BOARD_SIZE = 10;

async function resolveNames(
  guild: Guild | null,
  userIds: string[],
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  if (!guild || userIds.length === 0) return names;
  const members = await guild.members
    .fetch({ user: userIds })
    .catch(() => undefined);
  for (const id of userIds) {
    const displayName = members?.get(id)?.displayName;
    // Leave unresolved users out of the map so the panel renders a mention.
    if (displayName) names[id] = displayName;
  }
  return names;
}

async function render(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  metric: LeaderboardMetric,
): Promise<void> {
  const entries = await computeLeaderboard(metric, BOARD_SIZE);
  const names = await resolveNames(
    interaction.guild,
    entries.map((e) => e.userId),
  );
  const panel = buildLeaderboardPanel(metric, entries, names);
  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("See the top players in the arena.")
    .setContexts(InteractionContextType.Guild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Public leaderboard so the whole server can see the standings.
    await interaction.deferReply();
    await render(interaction, "cards");
  },

  async stringSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.customId !== "leaderboard:metric") return;
    const metric = interaction.values[0] as LeaderboardMetric;
    await interaction.deferUpdate();
    await render(interaction, metric);
  },
};

export default command;
