import { GuildMember, PermissionFlagsBits } from 'discord.js';
import type { GuildSettings, Ticket } from '../database/types';

export const isStaff = (member: GuildMember, settings: GuildSettings): boolean =>
  member.permissions.has(PermissionFlagsBits.ManageChannels) ||
  Boolean(settings.supportRoleId && member.roles.cache.has(settings.supportRoleId));

export const canAccessTicket = (
  member: GuildMember,
  settings: GuildSettings,
  ticket: Ticket
): boolean => ticket.ownerId === member.id || isStaff(member, settings);
