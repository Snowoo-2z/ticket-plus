import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

const row = (input: TextInputBuilder) =>
  new ActionRowBuilder<TextInputBuilder>().addComponents(input);

export const buildPanelModal = (draftId: string) =>
  new ModalBuilder()
    .setCustomId(`panel:create:${draftId}`)
    .setTitle('Nouveau panel')
    .addComponents(
      row(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Titre du panel')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setRequired(true)
      ),
      row(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description du panel')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(4000)
          .setRequired(true)
      ),
      row(
        new TextInputBuilder()
          .setCustomId('buttonLabel')
          .setLabel('Texte du bouton')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setValue('Créer un ticket')
          .setRequired(true)
      ),
      row(
        new TextInputBuilder()
          .setCustomId('welcomeTitle')
          .setLabel('Titre affiché dans le ticket')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setValue('Votre demande')
          .setRequired(true)
      ),
      row(
        new TextInputBuilder()
          .setCustomId('welcomeDescription')
          .setLabel("Message d'accueil du ticket")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(4000)
          .setPlaceholder('Décrivez votre demande. Un membre du support vous répondra ici.')
          .setRequired(true)
      )
    );

export const buildMemberModal = (ticketId: number, action: 'add' | 'remove') =>
  new ModalBuilder()
    .setCustomId(`ticket:${action}:${ticketId}`)
    .setTitle(action === 'add' ? 'Ajouter un membre' : 'Retirer un membre')
    .addComponents(
      row(
        new TextInputBuilder()
          .setCustomId('user')
          .setLabel('Mention ou identifiant du membre')
          .setStyle(TextInputStyle.Short)
          .setMinLength(17)
          .setMaxLength(23)
          .setRequired(true)
      )
    );

export const buildRenameModal = (ticketId: number) =>
  new ModalBuilder()
    .setCustomId(`ticket:rename:${ticketId}`)
    .setTitle('Renommer le ticket')
    .addComponents(
      row(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Nouveau nom')
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(60)
          .setRequired(true)
      )
    );
