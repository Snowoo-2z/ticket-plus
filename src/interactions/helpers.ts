import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuInteraction
} from 'discord.js';
import { UserError } from '../utils/errors';

export type SupportedInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;

export const requireGuildMember = async (interaction: SupportedInteraction): Promise<GuildMember> => {
  if (!interaction.guild) throw new UserError('Cette action doit être utilisée sur un serveur.');
  return interaction.guild.members.fetch(interaction.user.id);
};

export const replyError = async (interaction: SupportedInteraction, error: unknown): Promise<void> => {
  const content = error instanceof UserError
    ? error.message
    : 'Une erreur est survenue. Vérifiez les permissions du bot.';

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content, components: [] }).catch(() => undefined);
  } else {
    await interaction.reply({ content, components: [], flags: MessageFlags.Ephemeral }).catch(() => undefined);
  }

  if (!(error instanceof UserError)) console.error(error);
};

export const parseTicketId = (value: string): number => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new UserError('Ticket invalide.');
  return id;
};
