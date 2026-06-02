import { MessageFlags } from 'discord.js';
import { getOrCreateBadgeEmoji } from '../../utils/badgeEmojis.js';

export default {
  name: 'userinfo',
  configSchema: { type: 'object', properties: {} },
  commands: [
    {
      name: 'userinfo',
      description: 'Show user information',
      ephemeral: false,
      options: [
        {
          name: 'user',
          type: 6,
          description: 'The user to show info for',
          required: false
        }
      ],
      async execute(interaction, context) {
        const targetUser = interaction.options.getUser('user') ?? interaction.user;
        const targetMember = interaction.guild
          ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
          : null;

        const fullUser = await context.discordClient.users.fetch(targetUser.id, { force: true })
          .catch(() => targetUser);

        const bodyLines = [];

        bodyLines.push('-# USER INFO');

        let mentionLine = targetUser.toString();
        const primaryGuild = fullUser.primaryGuild ?? null;

        if (primaryGuild) {
          let badgeText = '';
          let tagText = '';

          const badge = primaryGuild.badge;
          if (badge) {
            let badgeUrl = null;
            if (typeof badge?.url === 'string') {
              badgeUrl = badge.url;
            } else if (typeof badge === 'string') {
              badgeUrl = badge;
            }

            if (badgeUrl?.startsWith('https://')) {
              const emojiId = await getOrCreateBadgeEmoji(context.discordClient, badgeUrl);
              if (emojiId) {
                const emojiName = `badge_${badgeUrl.split('/').pop().replace('.png', '').slice(0, 8)}`;
                badgeText = ` <${emojiName}:${emojiId}>`;
              }
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

        const containerComponents = [];

        let bannerUrl = null;
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
            type: 10,
            content: bodyContent
          });
        }
        containerComponents.push({
          type: 11,
          media: { url: avatarUrl }
        });

        const buttons = [];

        if (targetMember) {
          const roles = targetMember.roles.cache.filter(r => r.name !== '@everyone');
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
      }
    }
  ],
  events: [
    {
      name: 'interactionCreate',
      async execute(interaction) {
        if (!interaction.isButton() || !interaction.customId.startsWith('roles_')) {
          return;
        }

        const userId = interaction.customId.split('_')[1];

        if (interaction.user.id !== userId) {
          await interaction.reply({
            content: 'These buttons are not for you.',
            ephemeral: true
          });
          return;
        }

        const member = interaction.guild?.members.cache.get(userId);
        if (!member) {
          await interaction.reply({
            content: 'User not found in this server.',
            ephemeral: true
          });
          return;
        }

        const roles = member.roles.cache
          .filter(r => r.name !== '@everyone')
          .sort((a, b) => b.position - a.position);

        if (roles.size === 0) {
          await interaction.reply({
            content: 'This user has no roles.',
            ephemeral: true
          });
          return;
        }

        const rolesText = roles.map(r => r.toString()).join(' ');

        await interaction.reply({
          content: rolesText,
          ephemeral: true,
          allowedMentions: { parse: [] }
        });
      }
    }
  ]
};
