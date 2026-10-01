import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import type { BotContext } from './context';
import { buildPanelModal } from '../ui/modals';
import { UserError } from '../utils/errors';

export const handleCommand = async (
  interaction: ChatInputCommandInteraction,
  context: BotContext
): Promise<void> => {
  if (!interaction.inCachedGuild()) throw new UserError('Cette commande doit être utilisée sur un serveur.');

  if (interaction.commandName === 'panel-ticket') {
    const image = interaction.options.getAttachment('image');
    if (image) {
      const imageType = image.contentType?.toLowerCase();
      if (!imageType?.startsWith('image/')) throw new UserError('Le fichier joint doit être une image.');
      if (image.size > 10 * 1024 * 1024) throw new UserError('L’image ne doit pas dépasser 10 Mo.');
    }

    if (!interaction.channel?.isSendable()) throw new UserError('Le panel ne peut pas être envoyé ici.');
    const draft = context.drafts.create({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      imageUrl: image?.url ?? null
    });

    try {
      await interaction.showModal(buildPanelModal(draft.id));
    } catch (error) {
      context.drafts.delete(draft.id);
      throw error;
    }
    return;
  }

  if (interaction.commandName === 'ticket-categorie-config') {
    const category = interaction.options.getChannel('categorie', true);
    const supportRole = interaction.options.getRole('role-support');
    const logChannel = interaction.options.getChannel('salon-logs');

    if (category.type !== ChannelType.GuildCategory) throw new UserError('La catégorie est invalide.');
    if (supportRole?.id === interaction.guildId) throw new UserError('Le rôle @everyone ne peut pas être utilisé.');
    if (logChannel && logChannel.type !== ChannelType.GuildText && logChannel.type !== ChannelType.GuildAnnouncement) {
      throw new UserError('Le salon de logs est invalide.');
    }

    const settings = context.repository.configureGuild(
      interaction.guildId,
      category.id,
      supportRole?.id,
      logChannel?.id
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Configuration enregistrée')
      .addFields(
        { name: 'Catégorie', value: `<#${settings.categoryId}>`, inline: true },
        { name: 'Rôle support', value: settings.supportRoleId ? `<@&${settings.supportRoleId}>` : 'Non défini', inline: true },
        { name: 'Salon de logs', value: settings.logChannelId ? `<#${settings.logChannelId}>` : 'Non défini', inline: true }
      )
      .setFooter({ text: 'ticket-plus' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
