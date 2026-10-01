import {
  ChannelType,
  Guild,
  GuildMember,
  OverwriteResolvable,
  PermissionFlagsBits,
  TextChannel
} from 'discord.js';
import { Repository } from '../database/repository';
import type { GuildSettings, Panel, Ticket } from '../database/types';
import { buildTicketMessage } from '../ui/builders';
import { UserError } from '../utils/errors';
import { KeyedLocks } from '../utils/locks';
import {
  closedChannelName,
  padTicketNumber,
  ticketChannelName
} from '../utils/text';
import { LogService } from './log-service';
import { TranscriptService } from './transcript-service';

export interface CreatedTicketResult {
  ticket: Ticket;
  channel: TextChannel;
  existing: boolean;
}

export class TicketService {
  private readonly locks = new KeyedLocks();

  constructor(
    private readonly repository: Repository,
    private readonly transcripts: TranscriptService,
    private readonly logs: LogService
  ) {}

  async create(guild: Guild, user: GuildMember, panelId: string): Promise<CreatedTicketResult> {
    return this.locks.run(`create:${guild.id}:${user.id}`, async () => {
      const panel = this.requirePanel(panelId, guild.id);
      const settings = this.requireSettings(guild.id);
      const current = this.repository.findCurrentTicket(guild.id, user.id);

      if (current) {
        const currentChannel = await guild.channels.fetch(current.channelId).catch(() => null);
        if (currentChannel instanceof TextChannel) {
          return { ticket: current, channel: currentChannel, existing: true };
        }
        this.repository.setStatus(current.id, 'DELETED');
      }

      const category = await guild.channels.fetch(settings.categoryId).catch(() => null);
      if (!category || category.type !== ChannelType.GuildCategory) {
        throw new UserError('La catégorie configurée est introuvable.');
      }

      const bot = guild.members.me ?? await guild.members.fetchMe();
      const permissions = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.UseApplicationCommands
      ];
      const permissionOverwrites: OverwriteResolvable[] = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: bot.id,
          allow: [
            ...permissions,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages
          ]
        },
        {
          id: user.id,
          allow: permissions
        }
      ];

      if (settings.supportRoleId) {
        const supportRole = guild.roles.cache.get(settings.supportRoleId);
        if (supportRole) permissionOverwrites.push({ id: supportRole.id, allow: permissions });
      }

      const number = this.repository.nextTicketNumber(guild.id);
      const channelName = ticketChannelName(number, user.user.username);
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Ticket #${padTicketNumber(number)} • ${user.user.tag} • ${user.id}`,
        permissionOverwrites,
        reason: `Ticket #${padTicketNumber(number)} créé par ${user.user.tag}`
      });

      let ticket: Ticket;
      try {
        ticket = this.repository.createTicket({
          guildId: guild.id,
          channelId: channel.id,
          ownerId: user.id,
          panelId: panel.id,
          number,
          channelName
        });
      } catch (error) {
        await channel.delete().catch(() => undefined);
        throw error;
      }

      try {
        const message = await channel.send({
          content: `<@${user.id}>`,
          ...buildTicketMessage(panel, ticket),
          allowedMentions: { users: [user.id] }
        });
        this.repository.setControlMessage(ticket.id, message.id);
        ticket = this.repository.getTicket(ticket.id)!;
      } catch (error) {
        this.repository.setStatus(ticket.id, 'DELETED');
        await channel.delete().catch(() => undefined);
        throw error;
      }

      await this.logs.send(guild, settings, {
        title: `Ticket #${padTicketNumber(number)} créé`,
        description: `Salon : <#${channel.id}>\nDemandeur : <@${user.id}>`,
        color: 0x57f287
      }).catch(() => undefined);

      return { ticket, channel, existing: false };
    });
  }

  async claim(guild: Guild, member: GuildMember, ticket: Ticket): Promise<string> {
    return this.locks.run(`ticket:${ticket.id}`, async () => {
      const fresh = this.requireTicket(ticket.id, guild.id);
      if (fresh.status !== 'OPEN') throw new UserError('Ce ticket est fermé.');
      if (fresh.claimedBy && fresh.claimedBy !== member.id) {
        throw new UserError(`Ce ticket est déjà pris par <@${fresh.claimedBy}>.`);
      }

      const claimedBy = fresh.claimedBy === member.id ? null : member.id;
      this.repository.setClaimedBy(fresh.id, claimedBy);
      await this.refresh(guild, fresh.id);

      const settings = this.requireSettings(guild.id);
      await this.logs.send(guild, settings, {
        title: claimedBy ? 'Ticket pris en charge' : 'Ticket libéré',
        description: `Ticket : <#${fresh.channelId}>\nMembre : <@${member.id}>`,
        color: claimedBy ? 0x5865f2 : 0xfee75c
      }).catch(() => undefined);

      return claimedBy ? 'Le ticket vous est attribué.' : 'Le ticket est de nouveau disponible.';
    });
  }

  async close(guild: Guild, actor: GuildMember, ticket: Ticket): Promise<void> {
    await this.locks.run(`ticket:${ticket.id}`, async () => {
      const fresh = this.requireTicket(ticket.id, guild.id);
      if (fresh.status !== 'OPEN') throw new UserError('Ce ticket est déjà fermé.');
      const channel = await this.requireChannel(guild, fresh.channelId);
      const memberIds = [fresh.ownerId, ...this.repository.getMembers(fresh.id)];

      for (const memberId of memberIds) {
        await channel.permissionOverwrites.edit(memberId, {
          SendMessages: false,
          AddReactions: false
        }).catch(() => undefined);
      }

      this.repository.setStatus(fresh.id, 'CLOSED');
      await channel.setName(closedChannelName(fresh.channelName)).catch(() => undefined);
      await this.refresh(guild, fresh.id);

      const settings = this.requireSettings(guild.id);
      let attachment;
      if (settings.logChannelId) {
        attachment = await this.transcripts.create(channel, fresh).catch(() => undefined);
      }
      await this.logs.send(guild, settings, {
        title: `Ticket #${padTicketNumber(fresh.number)} fermé`,
        description: `Salon : <#${fresh.channelId}>\nFermé par : <@${actor.id}>`,
        color: 0xed4245,
        attachment
      }).catch(() => undefined);
    });
  }

  async reopen(guild: Guild, actor: GuildMember, ticket: Ticket): Promise<void> {
    await this.locks.run(`ticket:${ticket.id}`, async () => {
      const fresh = this.requireTicket(ticket.id, guild.id);
      if (fresh.status !== 'CLOSED') throw new UserError('Ce ticket n’est pas fermé.');
      const channel = await this.requireChannel(guild, fresh.channelId);
      const memberIds = [fresh.ownerId, ...this.repository.getMembers(fresh.id)];

      for (const memberId of memberIds) {
        await channel.permissionOverwrites.edit(memberId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
          AddReactions: true
        }).catch(() => undefined);
      }

      this.repository.setStatus(fresh.id, 'OPEN');
      await channel.setName(fresh.channelName).catch(() => undefined);
      await this.refresh(guild, fresh.id);

      const settings = this.requireSettings(guild.id);
      await this.logs.send(guild, settings, {
        title: `Ticket #${padTicketNumber(fresh.number)} rouvert`,
        description: `Salon : <#${fresh.channelId}>\nRouvert par : <@${actor.id}>`,
        color: 0x57f287
      }).catch(() => undefined);
    });
  }

  async addMember(guild: Guild, ticket: Ticket, userId: string): Promise<void> {
    const fresh = this.requireTicket(ticket.id, guild.id);
    if (fresh.status !== 'OPEN') throw new UserError('Ce ticket est fermé.');
    if (userId === fresh.ownerId) throw new UserError('Ce membre est déjà le demandeur.');
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) throw new UserError('Membre introuvable.');
    if (target.user.bot) throw new UserError('Un bot ne peut pas être ajouté.');
    const channel = await this.requireChannel(guild, fresh.channelId);

    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
      AddReactions: true
    });
    this.repository.addMember(fresh.id, userId);
  }

  async removeMember(guild: Guild, ticket: Ticket, userId: string): Promise<void> {
    const fresh = this.requireTicket(ticket.id, guild.id);
    if (fresh.status !== 'OPEN') throw new UserError('Ce ticket est fermé.');
    if (userId === fresh.ownerId) throw new UserError('Le demandeur ne peut pas être retiré.');
    const removed = this.repository.removeMember(fresh.id, userId);
    if (!removed) throw new UserError('Ce membre n’a pas été ajouté au ticket.');
    const channel = await this.requireChannel(guild, fresh.channelId);
    await channel.permissionOverwrites.delete(userId).catch(() => undefined);
  }

  async rename(guild: Guild, ticket: Ticket, label: string): Promise<string> {
    const fresh = this.requireTicket(ticket.id, guild.id);
    if (fresh.status !== 'OPEN') throw new UserError('Ce ticket est fermé.');
    const channel = await this.requireChannel(guild, fresh.channelId);
    const channelName = ticketChannelName(fresh.number, label);
    await channel.setName(channelName);
    this.repository.setChannelName(fresh.id, channelName);
    return channelName;
  }

  async createTranscript(guild: Guild, ticket: Ticket) {
    const channel = await this.requireChannel(guild, ticket.channelId);
    return this.transcripts.create(channel, ticket);
  }

  async scheduleDeletion(guild: Guild, actor: GuildMember, ticket: Ticket): Promise<void> {
    const fresh = this.requireTicket(ticket.id, guild.id);
    if (fresh.status !== 'CLOSED') throw new UserError('Fermez le ticket avant de le supprimer.');
    const channel = await this.requireChannel(guild, fresh.channelId);
    const settings = this.requireSettings(guild.id);
    const attachment = settings.logChannelId
      ? await this.transcripts.create(channel, fresh).catch(() => undefined)
      : undefined;

    await this.logs.send(guild, settings, {
      title: `Ticket #${padTicketNumber(fresh.number)} supprimé`,
      description: `Salon : ${channel.name}\nSupprimé par : <@${actor.id}>`,
      color: 0x2b2d31,
      attachment
    }).catch(() => undefined);

    this.repository.setStatus(fresh.id, 'DELETED');
    setTimeout(() => {
      channel.delete(`Ticket supprimé par ${actor.user.tag}`).catch(() => undefined);
    }, 2500).unref();
  }

  requireSettings(guildId: string): GuildSettings {
    const settings = this.repository.getSettings(guildId);
    if (!settings) throw new UserError('La catégorie des tickets n’est pas configurée.');
    return settings;
  }

  requireTicket(id: number, guildId: string, channelId?: string | null): Ticket {
    const ticket = this.repository.getTicket(id);
    if (!ticket || ticket.guildId !== guildId || (channelId && ticket.channelId !== channelId)) {
      throw new UserError('Ticket introuvable.');
    }
    return ticket;
  }

  private requirePanel(id: string, guildId: string): Panel {
    const panel = this.repository.getPanel(id);
    if (!panel || !panel.active || panel.guildId !== guildId) {
      throw new UserError('Ce panel n’est plus disponible.');
    }
    return panel;
  }

  private async requireChannel(guild: Guild, channelId: string): Promise<TextChannel> {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!(channel instanceof TextChannel)) throw new UserError('Le salon du ticket est introuvable.');
    return channel;
  }

  private async refresh(guild: Guild, ticketId: number): Promise<void> {
    const ticket = this.requireTicket(ticketId, guild.id);
    if (!ticket.controlMessageId) return;
    const panel = this.repository.getPanel(ticket.panelId);
    if (!panel) return;
    const channel = await this.requireChannel(guild, ticket.channelId);
    const message = await channel.messages.fetch(ticket.controlMessageId).catch(() => null);
    if (message) await message.edit(buildTicketMessage(panel, ticket));
  }
}
