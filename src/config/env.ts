import 'dotenv/config';
import path from 'node:path';

const requireValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable manquante: ${name}`);
  return value;
};

export const env = {
  token: requireValue('DISCORD_TOKEN'),
  applicationId: requireValue('DISCORD_APPLICATION_ID'),
  guildId: process.env.DISCORD_GUILD_ID?.trim() || null,
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH?.trim() || './data/ticket-plus.sqlite')
};
