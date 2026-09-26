import { REST, Routes } from "discord.js";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { logger } from "./utils/logger.js";
import { describeDeployFailure } from "./utils/errors.js";
import type { BotConfig } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load every command's SlashCommand JSON payload once. */
async function buildCommandData(): Promise<unknown[]> {
  const commandDir = join(__dirname, "commands");
  const files = readdirSync(commandDir).filter(
    (f) =>
      (f.endsWith(".js") || f.endsWith(".ts")) &&
      f !== "index.js" &&
      f !== "index.ts",
  );

  const commandData: unknown[] = [];
  for (const file of files) {
    const filePath = join(commandDir, file);
    const module = await import(pathToFileURL(filePath).href);
    if (module.default?.data) {
      commandData.push(module.default.data.toJSON());
    }
  }
  return commandData;
}

export async function deployCommands(config: BotConfig): Promise<void> {
  const rest = new REST().setToken(config.token);
  const commandData = await buildCommandData();

  try {
    // Always register globally so the commands exist in every server the bot is
    // invited to (global commands are what make /setup appear outside the home
    // server). Global propagation can take up to an hour, so when a guild id is
    // configured we ALSO register there for instant updates — Discord lets the
    // guild copy override the global one, so there is no duplicate in that guild.
    logger.info("Deploying commands globally.", { count: commandData.length });
    await rest.put(Routes.applicationCommands(config.clientId), { body: commandData });
    logger.info("Global commands deployed successfully.");

    if (config.guildId) {
      logger.info("Deploying commands to guild.", {
        guildId: config.guildId,
        count: commandData.length,
      });
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commandData },
      );
      logger.info("Guild commands deployed successfully.");
    }
  } catch (err: unknown) {
    // A raw 401 here just says "Unauthorized" and dumps the whole command
    // payload; say which setting is wrong instead.
    throw describeDeployFailure(err, config.clientId);
  }
}

/**
 * Register the full command set directly into specific guilds. Run after the
 * client is connected so we know every server the bot is a member of. Guild
 * copies of a command are served instantly (they don't wait on Discord's up-to-
 * one-hour global propagation), which is what makes /setup appear right away in
 * a server the bot was just added to.
 */
export async function deployCommandsToGuilds(
  config: BotConfig,
  guildIds: string[],
): Promise<void> {
  const unique = [...new Set(guildIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const rest = new REST().setToken(config.token);
  const commandData = await buildCommandData();

  for (const guildId of unique) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, guildId),
        { body: commandData },
      );
      logger.info("Synced commands to guild.", { guildId });
    } catch (err: unknown) {
      logger.warn("Could not sync commands to guild.", { guildId, error: err });
    }
  }
}

