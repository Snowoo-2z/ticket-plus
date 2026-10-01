import { Interaction } from 'discord.js';
import type { BotContext } from './context';
import { handleButton } from './buttons';
import { handleCommand } from './commands';
import { replyError } from './helpers';
import { handleModal } from './modals';
import { handleSelect } from './selects';

export const handleInteraction = async (
  interaction: Interaction,
  context: BotContext
): Promise<void> => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction, context);
      return;
    }
    if (interaction.isButton()) {
      await handleButton(interaction, context);
      return;
    }
    if (interaction.isModalSubmit()) {
      await handleModal(interaction, context);
      return;
    }
    if (interaction.isStringSelectMenu()) {
      await handleSelect(interaction, context);
    }
  } catch (error) {
    if (
      interaction.isChatInputCommand() ||
      interaction.isButton() ||
      interaction.isModalSubmit() ||
      interaction.isStringSelectMenu()
    ) {
      await replyError(interaction, error);
    } else {
      console.error(error);
    }
  }
};
