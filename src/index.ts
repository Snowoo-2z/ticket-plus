import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits
} from 'discord.js';
import { env } from './config/env';
import { Repository } from './database/repository';
import { deployCommands } from './deploy-commands';
import { handleInteraction } from './interactions/router';
import { LogService } from './services/log-service';
import { TicketService } from './services/ticket-service';
import { TranscriptService } from './services/transcript-service';
import { PanelDraftStore } from './stores/panel-drafts';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const repository = new Repository(env.databasePath);
const drafts = new PanelDraftStore();
const transcripts = new TranscriptService();
const logs = new LogService();
const tickets = new TicketService(repository, transcripts, logs);
const context = { repository, drafts, tickets };

client.once(Events.ClientReady, (readyClient) => {
  readyClient.user.setPresence({
    activities: [{ name: 'les tickets', type: ActivityType.Watching }],
    status: 'online'
  });
  console.log(`Connecté: ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction, context);
});

const shutdown = (): void => {
  client.destroy();
  repository.close();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

const start = async (): Promise<void> => {
  await deployCommands();
  await client.login(env.token);
};

start().catch((error) => {
  console.error(error);
  repository.close();
  process.exit(1);
});
