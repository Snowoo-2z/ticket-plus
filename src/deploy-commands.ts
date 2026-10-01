import { REST, Routes } from 'discord.js';
import { commandData } from './commands/definitions';
import { env } from './config/env';

export const deployCommands = async (): Promise<void> => {
  const rest = new REST({ version: '10' }).setToken(env.token);
  const route = env.guildId
    ? Routes.applicationGuildCommands(env.applicationId, env.guildId)
    : Routes.applicationCommands(env.applicationId);
  await rest.put(route, { body: commandData });
};

if (require.main === module) {
  deployCommands()
    .then(() => console.log('Commandes enregistrées.'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
