import {
  AttachmentBuilder,
  EmbedBuilder,
  Guild
} from 'discord.js';
import type { GuildSettings } from '../database/types';

export interface LogEntry {
  title: string;
  description: string;
  color: number;
  attachment?: AttachmentBuilder;
}

export class LogService {
  async send(guild: Guild, settings: GuildSettings, entry: LogEntry): Promise<boolean> {
    if (!settings.logChannelId) return false;
    const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
    if (!channel?.isTextBased() || !channel.isSendable() || channel.isThread()) return false;

    const embed = new EmbedBuilder()
      .setColor(entry.color)
      .setTitle(entry.title)
      .setDescription(entry.description)
      .setFooter({ text: 'ticket-plus' })
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      files: entry.attachment ? [entry.attachment] : [],
      allowedMentions: { parse: [] }
    });
    return true;
  }
}
