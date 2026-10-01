import {
  ButtonInteraction,
  MessageFlags
} from 'discord.js';
import type { BotContext } from './context';
import { buildCloseConfirmation } from '../ui/builders';
import { canAccessTicket, isStaff } from '../utils/access';
import { UserError } from '../utils/errors';
import { parseTicketId, requireGuildMember } from './helpers';

export const handleButton = async (
  interaction: ButtonInteraction,
  context: BotContext
): Promise<void> => {
  const [scope, action, idValue] = interaction.customId.split(':');
  if (scope !== 'ticket' || !action || !idValue) return;
  if (!interaction.guild) throw new UserError('Serveur introuvable.');

  if (action === 'create') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await requireGuildMember(interaction);
    const result = await context.tickets.create(interaction.guild, member, idValue);
    const content = result.existing
      ? `Vous avez déjà un ticket : <#${result.channel.id}>`
      : `Votre ticket est prêt : <#${result.channel.id}>`;
    await interaction.editReply(content);
    return;
  }

  const ticketId = parseTicketId(idValue);
  const ticket = context.tickets.requireTicket(ticketId, interaction.guild.id, interaction.channelId);
  const settings = context.tickets.requireSettings(interaction.guild.id);
  const member = await requireGuildMember(interaction);

  if (action === 'claim') {
    if (!isStaff(member, settings)) throw new UserError('Cette action est réservée au support.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const message = await context.tickets.claim(interaction.guild, member, ticket);
    await interaction.editReply(message);
    return;
  }

  if (action === 'close') {
    if (!canAccessTicket(member, settings, ticket)) throw new UserError('Vous ne pouvez pas fermer ce ticket.');
    await interaction.reply({
      content: 'Fermer ce ticket ?',
      components: [buildCloseConfirmation(ticket.id)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (action === 'close-cancel') {
    await interaction.update({ content: 'Fermeture annulée.', components: [] });
    return;
  }

  if (action === 'close-confirm') {
    if (!canAccessTicket(member, settings, ticket)) throw new UserError('Vous ne pouvez pas fermer ce ticket.');
    await interaction.deferUpdate();
    await context.tickets.close(interaction.guild, member, ticket);
    await interaction.editReply({ content: 'Ticket fermé.', components: [] });
    return;
  }

  if (action === 'reopen') {
    if (!isStaff(member, settings)) throw new UserError('Cette action est réservée au support.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await context.tickets.reopen(interaction.guild, member, ticket);
    await interaction.editReply('Ticket rouvert.');
    return;
  }

  if (action === 'transcript') {
    if (!canAccessTicket(member, settings, ticket)) throw new UserError('Vous ne pouvez pas exporter ce ticket.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const attachment = await context.tickets.createTranscript(interaction.guild, ticket);
    await interaction.editReply({ content: `Transcription du ticket #${ticket.number.toString().padStart(4, '0')}`, files: [attachment] });
    return;
  }

  if (action === 'delete') {
    if (!isStaff(member, settings)) throw new UserError('Cette action est réservée au support.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await context.tickets.scheduleDeletion(interaction.guild, member, ticket);
    await interaction.editReply('Le ticket sera supprimé dans quelques secondes.');
  }
};
