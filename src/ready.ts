import { Events, type Client } from "discord.js";
import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { deployCommandsToGuilds } from "../deploy-commands.js";
import { startSpawnManager } from "../features/mma/spawner.js";
import { startPackSweep } from "../features/mma/packs.js";
import type { BotEvent } from "./index.js";

const event: BotEvent<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,

  execute(client: Client<true>): void {
    const { storage } = loadConfig();
    client.user.setActivity("Built with VybeBot.ai");
    logger.info("Bot is online.", {
      tag: client.user.tag,
      dataDir: storage.dir,
      durableStorage: storage.durable,
    });

    // Sync the full command set into every guild the bot is a member of. Global
    // commands can take up to an hour to propagate to a newly-added server, which
    // is why /setup is flaky on other servers; guild copies are served instantly
    // and override the global ones, so this makes all commands appear in any
    // server right after it's configured.
    deployCommandsToGuilds(loadConfig(), [...client.guilds.cache.keys()]).catch(
      (err: unknown) => {
        logger.warn("Failed to sync commands to guilds.", { error: err });
      },
    );

    // Start the MMA fighter spawn manager
    startSpawnManager(client);

    // Auto-grant Daily / Weekly packs on the timer
    startPackSweep();
  },
};

export default event;

