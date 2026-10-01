import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import type { Panel, Ticket } from '../database/types';
import { padTicketNumber, renderTicketText } from '../utils/text';

export const buildPanelMessage = (panel: Panel) => {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(panel.title)
    .setDescription(panel.description)
    .setFooter({ text: 'ticket-plus' });

  if (panel.imageUrl) embed.setImage(panel.imageUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:create:${panel.id}`)
      .setLabel(panel.buttonLabel)
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
};

export const buildTicketMessage = (panel: Panel, ticket: Ticket) => {
  const isOpen = ticket.status === 'OPEN';
  const status = isOpen ? 'Ouvert' : 'Fermé';
  const embed = new EmbedBuilder()
    .setColor(isOpen ? 0x57f287 : 0xed4245)
    .setTitle(panel.welcomeTitle)
    .setDescription(
      renderTicketText(
        panel.welcomeDescription,
        ticket.ownerId,
        ticket.channelId,
        ticket.number
      )
    )
    .addFields(
      { name: 'Demandeur', value: `<@${ticket.ownerId}>`, inline: true },
      { name: 'Statut', value: status, inline: true },
      {
        name: 'Pris en charge par',
        value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Personne',
        inline: true
      }
    )
    .setFooter({ text: `Ticket #${padTicketNumber(ticket.number)} • ticket-plus` })
    .setTimestamp(ticket.createdAt);

  const buttons = new ActionRowBuilder<ButtonBuilder>();
  const menus: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

  if (isOpen) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:claim:${ticket.id}`)
        .setLabel(ticket.claimedBy ? 'Libérer' : 'Prendre')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticket.id}`)
        .setLabel('Fermer')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

    menus.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`ticket:manage:${ticket.id}`)
          .setPlaceholder('Gestion du ticket')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Ajouter un membre')
              .setValue('add')
              .setEmoji('➕'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Retirer un membre')
              .setValue('remove')
              .setEmoji('➖'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Renommer')
              .setValue('rename')
              .setEmoji('✏️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Exporter la discussion')
              .setValue('transcript')
              .setEmoji('📄')
          )
      )
    );
  } else {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:reopen:${ticket.id}`)
        .setLabel('Rouvrir')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket:transcript:${ticket.id}`)
        .setLabel('Transcription')
        .setEmoji('📄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket:delete:${ticket.id}`)
        .setLabel('Supprimer')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    );
  }

  return { embeds: [embed], components: [buttons, ...menus] };
};

export const buildCloseConfirmation = (ticketId: number) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close-confirm:${ticketId}`)
      .setLabel('Confirmer')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket:close-cancel:${ticketId}`)
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Secondary)
  );
