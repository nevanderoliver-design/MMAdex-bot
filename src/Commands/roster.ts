import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "./index.js";
import { CARD_FOOTER } from "../features/mma/card.js";
import { RARITIES, getAllFighters, rarityDef } from "../features/mma/data.js";
import type { FighterDef } from "../features/mma/types.js";

const PER_PAGE = 18;

const rarityOrder = new Map(RARITIES.map((r, i) => [r.id, i]));

/** All fighters ordered rarest → least rare, then by power descending. */
function sortedFighters(): FighterDef[] {
  return [...getAllFighters()].sort(
    (a, b) =>
      (rarityOrder.get(a.rarity) ?? 99) - (rarityOrder.get(b.rarity) ?? 99) ||
      b.power - a.power,
  );
}

function labelFor(card: FighterDef): string {
  return card.nickname ? `${card.name} "${card.nickname}"` : card.name;
}

async function render(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  page: number,
): Promise<void> {
  const all = sortedFighters();
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = all.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  const lines = slice.map((f) => {
    const rarity = rarityDef(f.rarity);
    return `${rarity.emoji} **${labelFor(f)}** — ⚡ ${f.power} · ${f.division}`;
  });

  const header = [
    "# 👑 Fighter Roster",
    `All fighters, rarest to least rare (Page **${safePage + 1}/${totalPages}** · ${all.length} total).`,
  ];

  const panel = new ContainerBuilder()
    .setAccentColor(0x9b59b6)
    .addTextDisplayComponents((text) => text.setContent(header.join("\n")))
    .addTextDisplayComponents((text) =>
      text.setContent(lines.join("\n") || "_No fighters in the database._"),
    );

  if (totalPages > 1) {
    const prev = new ButtonBuilder()
      .setCustomId(`roster:page:${safePage - 1}`)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0);
    const next = new ButtonBuilder()
      .setCustomId(`roster:page:${safePage + 1}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === totalPages - 1);
    panel.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next),
    );
  }

  panel.addTextDisplayComponents((text) =>
    text.setContent(`${CARD_FOOTER}`),
  );

  await interaction.editReply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Browse every fighter, rarest first.")
    .setContexts(InteractionContextType.Guild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    await render(interaction, 0);
  },

  async button(interaction: ButtonInteraction): Promise<void> {
    const [action, pageStr] = interaction.customId.split(":");
    if (action !== "roster" || pageStr !== "page") return;
    await interaction.deferUpdate();
    await render(interaction, Number(interaction.customId.split(":")[2] ?? 0));
  },
};

export default command;
