import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';

export const commandBuilders = [
  new SlashCommandBuilder()
    .setName('panel-ticket')
    .setDescription('Créer un panel de tickets')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('Image affichée dans le panel')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('ticket-categorie-config')
    .setDescription('Configurer les tickets du serveur')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('categorie')
        .setDescription('Catégorie de création des tickets')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName('role-support')
        .setDescription('Rôle autorisé à gérer les tickets')
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName('salon-logs')
        .setDescription('Salon des journaux et transcriptions')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
];

export const commandData = commandBuilders.map((command) => command.toJSON());
