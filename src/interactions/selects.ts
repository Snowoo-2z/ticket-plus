import {
  MessageFlags,
  StringSelectMenuInteraction
} from 'discord.js';
import type { BotContext } from './context';
import { buildMemberModal, buildRenameModal } from '../ui/modals';
import { canAccessTicket, isStaff } from '../utils/access';
import { UserError } from '../utils/errors';
import { parseTicketId, requireGuildMember } from './helpers';

export const handleSelect = async (
  interaction: StringSelectMenuInteraction,
  context: BotContext
): Promise<void> => {
  const [scope, action, idValue] = interaction.customId.split(':');
  if (scope !== 'ticket' || action !== 'manage' || !idValue || !interaction.guild) return;

  const ticketId = parseTicketId(idValue);
  const ticket = context.tickets.requireTicket(ticketId, interaction.guild.id, interaction.channelId);
  const settings = context.tickets.requireSettings(interaction.guild.id);
  const member = await requireGuildMember(interaction);
  const selected = interaction.values[0];

  if (selected === 'transcript') {
    if (!canAccessTicket(member, settings, ticket)) throw new UserError('Vous ne pouvez pas exporter ce ticket.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const attachment = await context.tickets.createTranscript(interaction.guild, ticket);
    await interaction.editReply({ content: `Transcription du ticket #${ticket.number.toString().padStart(4, '0')}`, files: [attachment] });
    return;
  }

  if (!isStaff(member, settings)) throw new UserError('Cette action est réservée au support.');

  if (selected === 'add' || selected === 'remove') {
    await interaction.showModal(buildMemberModal(ticket.id, selected));
    return;
  }

  if (selected === 'rename') {
    await interaction.showModal(buildRenameModal(ticket.id));
  }
};
