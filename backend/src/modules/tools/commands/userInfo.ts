import { MessageFlags } from 'discord.js';
import { getOrCreateBadgeEmoji } from '../../../utils/badgeEmojis.js';
import type { InteractionResult } from '../../../types/index.js';

export default {
  name: 'user',
  description: 'User information commands',
  ephemeral: false,
  options: [
    {
      name: 'info',
      type: 1,
      description: 'Show user information',
      options: [
        {
          name: 'user',
          type: 6,
          description: 'The user to show info for',
          required: false
        }
      ]
    }
  ],
  async execute(interaction: any, context: any): Promise<InteractionResult> {
    if (interaction.options.getSubcommand(true) !== 'info') {
      await interaction.editReply('Unknown subcommand.');
      return { type: 'IGNORE' };
    }

    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const targetMember = interaction.guild
      ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
      : null;

    const fullUser = await context.discordClient.users.fetch(targetUser.id, { force: true })
      .catch(() => targetUser);

    const bodyLines: string[] = [];

    bodyLines.push('-# USER INFO');

    let mentionLine = targetUser.toString();
    const primaryGuild = fullUser.primaryGuild ?? null;

    if (primaryGuild) {
      let badgeText = '';
      let tagText = '';

      const badge = primaryGuild.badge;
      if (badge) {
        let badgeUrl: string | null = null;
        if (typeof badge?.url === 'string') {
          badgeUrl = badge.url;
        } else if (typeof badge === 'string') {
          badgeUrl = badge;
        }

        if (badgeUrl?.startsWith('https://')) {
          try {
            const emojiId = await getOrCreateBadgeEmoji(context.discordClient, badgeUrl);
            if (emojiId) {
              const emojiName = `badge_${badgeUrl.split('/').pop()!.replace('.png', '').slice(0, 8)}`;
              badgeText = ` <${emojiName}:${emojiId}>`;
            }
          } catch {}
        }
      }

      if (primaryGuild.identityEnabled && primaryGuild.tag) {
        tagText = ` ${primaryGuild.tag}`;
      }

      mentionLine += `${badgeText}${tagText}`;
    }

    bodyLines.push(mentionLine);
    bodyLines.push(`**Username**: \`${targetUser.username}\``);
    bodyLines.push(`**UserID**: \`${targetUser.id}\``);
    bodyLines.push('-# MEMBER SINCE');

    const createdTimestamp = Math.floor(targetUser.createdAt.getTime() / 1000);
    bodyLines.push(`**Account created**: <t:${createdTimestamp}:D>`);

    if (targetMember?.joinedAt) {
      const joinedTimestamp = Math.floor(targetMember.joinedAt.getTime() / 1000);
      bodyLines.push(`**Server joined**: <t:${joinedTimestamp}:D>`);
    }

    const bodyContent = bodyLines.join('\n');

    const containerComponents: any[] = [];

    let bannerUrl: string | null = null;
    if (targetMember?.guildBanner) {
      bannerUrl = targetMember.guildBannerURL({ size: 1024 });
    }
    if (!bannerUrl && fullUser.banner) {
      bannerUrl = fullUser.bannerURL({ size: 1024 });
    }

    if (bannerUrl) {
      containerComponents.push({
        type: 12,
        items: [{ media: { url: bannerUrl } }]
      });
    }

    const avatarUrl = (targetMember ?? targetUser).displayAvatarURL({ size: 512 });
    if (bodyContent) {
      containerComponents.push({
        type: 9,
        components: [{
          type: 10,
          content: bodyContent
        }],
        accessory: {
          type: 11,
          media: { url: avatarUrl }
        }
      });
    }

    const buttons: any[] = [];

    if (targetMember) {
      const roles = targetMember.roles.cache.filter((r: any) => r.name !== '@everyone');
      if (roles.size > 0) {
        buttons.push({
          type: 2,
          label: 'ROLES',
          custom_id: `roles_${targetUser.id}`,
          style: 2
        });
      }
    }

    const decorUrl = fullUser.avatarDecorationURL?.();
    if (decorUrl) {
      buttons.push({
        type: 2,
        label: 'DECOR',
        url: decorUrl,
        style: 5
      });
    }

    if (buttons.length > 0) {
      containerComponents.push({
        type: 1,
        components: buttons
      });
    }

    const components = [{
      type: 17,
      components: containerComponents
    }];

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components,
      allowedMentions: { parse: [] }
    });

    return { type: 'IGNORE' };
  }
};
