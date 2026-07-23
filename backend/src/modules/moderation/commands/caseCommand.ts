import { ApplicationCommandType, MessageFlags } from 'discord.js';
import {
  canUseCaseCommand, computeMessageContentLimit, buildMessageUrl,
  extractDisplayMessageContent, getAttachmentData, buildPreviewComponents
} from '../helpers.js';
import type { CaseReport } from '../helpers.js';

export default {
  name: 'case',
  type: ApplicationCommandType.Message,
  defer: false,
  ephemeral: true,
  async execute(interaction: any): Promise<void> {
    try {
      await handleCaseCommand(interaction);
    } catch (error: any) {
      await interaction.reply({ content: `Case command failed: ${error?.message ?? 'unknown error'}`, ephemeral: true }).catch(() => null);
    }
  }
};

async function handleCaseCommand(interaction: any): Promise<void> {
  if (!interaction.guildId || !interaction.guild || !interaction.targetMessage) {
    await interaction.reply({ content: 'This command can only be used on a server message.', ephemeral: true });
    return;
  }

  if (!canUseCaseCommand(interaction.member, interaction.guild)) {
    await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    return;
  }

  const targetMessage = interaction.targetMessage;
  if (!targetMessage.author?.id) {
    await interaction.reply({ content: 'This message cannot be reported.', ephemeral: true });
    return;
  }
  if (targetMessage.author.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot open a case on your own message.', ephemeral: true });
    return;
  }

  const limit = computeMessageContentLimit({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: targetMessage.id,
    targetUserId: targetMessage.author.id,
    reporterId: interaction.user.id,
    targetUsername: targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown'
  });

  const report: CaseReport = {
    guildId: interaction.guildId,
    reporterId: interaction.user.id,
    targetUserId: targetMessage.author.id,
    targetUsername: targetMessage.author.tag ?? targetMessage.author.username ?? 'Unknown',
    messageId: targetMessage.id,
    channelId: interaction.channelId,
    messageUrl: buildMessageUrl(interaction.guildId, interaction.channelId, targetMessage.id),
    reportedTimestamp: Math.floor(Date.now() / 1000),
    messageContent: extractDisplayMessageContent(targetMessage, limit),
    attachments: getAttachmentData(targetMessage)
  };

  await interaction.reply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: buildPreviewComponents(report),
    allowedMentions: { parse: [] }
  });
}
