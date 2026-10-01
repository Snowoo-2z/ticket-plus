import {
  MessageFlags,
  ModalSubmitInteraction
} from 'discord.js';
import type { BotContext } from './context';
import { buildPanelMessage } from '../ui/builders';
import { isStaff } from '../utils/access';
import { UserError } from '../utils/errors';
import { extractUserId } from '../utils/text';
import { parseTicketId, requireGuildMember } from './helpers';

export const handleModal = async (
  interaction: ModalSubmitInteraction,
  context: BotContext
): Promise<void> => {
  const [scope, action, idValue] = interaction.customId.split(':');
  if (!scope || !action || !idValue) return;

  if (scope === 'panel' && action === 'create') {
    const draft = context.drafts.consume(idValue, interaction.user.id);
    if (!draft || !interaction.guild || interaction.guild.id !== draft.guildId) {
      throw new UserError('Ce formulaire a expiré.');
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = await interaction.guild.channels.fetch(draft.channelId).catch(() => null);
    if (!channel?.isSendable()) throw new UserError('Le salon du panel est introuvable.');

    const title = interaction.fields.getTextInputValue('title').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const buttonLabel = interaction.fields.getTextInputValue('buttonLabel').trim();
    const welcomeTitle = interaction.fields.getTextInputValue('welcomeTitle').trim();
    const welcomeDescription = interaction.fields.getTextInputValue('welcomeDescription').trim();
    if (!title || !description || !buttonLabel || !welcomeTitle || !welcomeDescription) {
      throw new UserError('Tous les champs doivent être remplis.');
    }

    const panel = context.repository.createPanel({
      guildId: draft.guildId,
      channelId: draft.channelId,
      title,
      description,
      buttonLabel,
      welcomeTitle,
      welcomeDescription,
      imageUrl: draft.imageUrl,
      createdBy: interaction.user.id
    });

    try {
      const message = await channel.send(buildPanelMessage(panel));
      context.repository.setPanelMessage(panel.id, message.id);
    } catch (error) {
      context.repository.deactivatePanel(panel.id);
      throw error;
    }

    await interaction.editReply('Panel envoyé.');
    return;
  }

  if (scope !== 'ticket' || !interaction.guild) return;
  const ticketId = parseTicketId(idValue);
  const ticket = context.tickets.requireTicket(ticketId, interaction.guild.id, interaction.channelId);
  const settings = context.tickets.requireSettings(interaction.guild.id);
  const member = await requireGuildMember(interaction);

  if (!isStaff(member, settings)) throw new UserError('Cette action est réservée au support.');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === 'add' || action === 'remove') {
    const userId = extractUserId(interaction.fields.getTextInputValue('user'));
    if (!userId) throw new UserError('Mention ou identifiant invalide.');

    if (action === 'add') {
      await context.tickets.addMember(interaction.guild, ticket, userId);
      await interaction.editReply(`<@${userId}> a été ajouté au ticket.`);
    } else {
      await context.tickets.removeMember(interaction.guild, ticket, userId);
      await interaction.editReply(`<@${userId}> a été retiré du ticket.`);
    }
    return;
  }

  if (action === 'rename') {
    const name = interaction.fields.getTextInputValue('name').trim();
    const channelName = await context.tickets.rename(interaction.guild, ticket, name);
    await interaction.editReply(`Le ticket s’appelle maintenant ${channelName}.`);
  }
};
