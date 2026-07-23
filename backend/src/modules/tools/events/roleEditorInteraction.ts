import { AttachmentBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } from 'discord.js';
import { parseRoleCid, cidRole } from '../customIds.js';
import { generatePreview, hexToColorName } from '../colors.js';
import { buildRoleSelect, buildActionSelect, buildPreviewContainer, buildResultContainer, errorEdit } from '../roleEditorUI.js';
import { R } from '../helpers.js';
import { logger } from '../../../utils/logger.js';
import type { InteractionResult } from '../../../types/index.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: any): Promise<InteractionResult | undefined> {
    if (interaction.isCommand()) return undefined;
    if (!interaction.customId) return R.ignore();
    const parsed = parseRoleCid(interaction.customId);
    if (!parsed) return R.ignore();

    const { action, userId, data } = parsed;

    if (interaction.user.id !== userId) {
      return R.error('This panel belongs to another user.');
    }

    if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return R.error('You need the Manage Roles permission.');
    }

    if (action === 'role' && interaction.isRoleSelectMenu()) {
      return {
        type: 'ASYNC_RESULT',
        execute: async (): Promise<InteractionResult> => {
          const roleId = interaction.values[0];
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return errorEdit('This role cannot be edited.');
          }

          if (role.color && !role.colors?.primaryColor) {
            logger.warn('role.color is deprecated, use role.colors.primaryColor instead', { roleId: role.id, guildId: interaction.guild.id });
          }
          const primaryVal = role.colors?.primaryColor ?? role.color;
          const secondaryVal = role.colors?.secondaryColor ?? 0;
          const tertiaryVal = role.colors?.tertiaryColor ?? 0;
          const hasColor = primaryVal !== 0;
          const previewHex = hasColor ? `#${primaryVal.toString(16).padStart(6, '0')}` : '#ffffff';
          const previewHex2 = secondaryVal ? `#${secondaryVal.toString(16).padStart(6, '0')}` : null;
          const previewHex3 = tertiaryVal ? `#${tertiaryVal.toString(16).padStart(6, '0')}` : null;

          const previewBuffer = await generatePreview(
            interaction.user.displayAvatarURL({ extension: 'png', size: 4096 }),
            interaction.member.displayName || interaction.user.username,
            previewHex,
            previewHex2
          );

          const file = new AttachmentBuilder(previewBuffer, { name: 'preview.png' });

          const container = buildPreviewContainer(interaction.user.id, previewHex, roleId, role.name, hasColor ? null : 'Default', previewHex2, previewHex3)
            .addActionRowComponents((row: any) =>
              row.setComponents(buildActionSelect(interaction.user.id, roleId))
            )
            .addActionRowComponents((row: any) =>
              row.setComponents(
                new ButtonBuilder()
                  .setCustomId(cidRole('confirm', interaction.user.id, roleId))
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel('CONFIRM')
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId(cidRole('cancel', interaction.user.id))
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel('CANCEL')
              )
            );

          return {
            type: 'EDIT_REPLY',
            components: [container],
            files: [file],
            allowedMentions: { roles: [] }
          } as InteractionResult;
        }
      };
    }

    if (action === 'action' && interaction.isStringSelectMenu()) {
      const value = interaction.values[0];
      const roleId = data[0];
      if (!roleId) return R.error('Select a role first.');

      const role = interaction.guild.roles.cache.get(roleId);
      if (!role || !role.editable) {
        return R.error('This role cannot be edited.');
      }

      if (value === 'color') {
        const supportsGradient = interaction.guild.features.includes('ENHANCED_ROLE_COLORS');

        const modalRows: ActionRowBuilder<TextInputBuilder>[] = [
          new ActionRowBuilder<TextInputBuilder>()
            .addComponents(
              new TextInputBuilder()
                .setCustomId('hex1')
                .setLabel('Primary Color')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('ff5733')
                .setRequired(true)
                .setMinLength(6)
                .setMaxLength(6)
            )
        ];

        if (supportsGradient) {
          modalRows.push(
            new ActionRowBuilder<TextInputBuilder>()
              .addComponents(
                new TextInputBuilder()
                  .setCustomId('hex2')
                  .setLabel('Secondary Color (optional)')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('0000ff')
                  .setRequired(false)
                  .setMinLength(6)
                  .setMaxLength(6)
              )
          );
          modalRows.push(
            new ActionRowBuilder<TextInputBuilder>()
              .addComponents(
                new TextInputBuilder()
                  .setCustomId('hex3')
                  .setLabel('Tertiary Color (for holographic style)')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('optional')
                  .setRequired(false)
                  .setMinLength(6)
                  .setMaxLength(6)
              )
          );
        }

        const modal = new ModalBuilder()
          .setTitle('Set Role Color')
          .setCustomId(cidRole('colormodal', userId, roleId, interaction.message.id))
          .addComponents(...modalRows);
        return R.modal(modal);
      }

      if (value === 'name') {
        const modal = new ModalBuilder()
          .setTitle('Change Role Name')
          .setCustomId(cidRole('namemodal', userId, roleId, interaction.message.id))
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>()
              .addComponents(
                new TextInputBuilder()
                  .setCustomId('name')
                  .setLabel('New Role Name')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('Enter new role name...')
                  .setRequired(true)
                  .setMinLength(1)
                  .setMaxLength(100)
                  .setValue(role.name)
              )
          );
        return R.modal(modal);
      }

      if (value === 'icon') {
        if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
          return R.error('You need the Manage Guild Expressions permission to change role icons.');
        }
        const modal = new ModalBuilder()
          .setTitle('Set Role Icon')
          .setCustomId(cidRole('iconmodal', userId, roleId, interaction.message.id))
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>()
              .addComponents(
                new TextInputBuilder()
                  .setCustomId('icon')
                  .setLabel('Image URL')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('https://example.com/icon.png')
                  .setRequired(true)
              )
          );
        return R.modal(modal);
      }
    }

    if (action === 'colormodal' && interaction.isModalSubmit()) {
      const [roleId, messageId] = data;
      if (!roleId) return R.error('Select a role first.');

      const hex1Raw = interaction.fields.getTextInputValue('hex1').trim();
      const hex2Raw = interaction.fields.fields.has('hex2')
        ? (interaction.fields.getTextInputValue('hex2').trim())
        : '';
      const hex3Raw = interaction.fields.fields.has('hex3')
        ? (interaction.fields.getTextInputValue('hex3').trim())
        : '';

      const hex1 = hex1Raw.startsWith('#') ? hex1Raw : '#' + hex1Raw;
      const hex2 = hex2Raw ? (hex2Raw.startsWith('#') ? hex2Raw : '#' + hex2Raw) : null;
      const hex3 = hex3Raw ? (hex3Raw.startsWith('#') ? hex3Raw : '#' + hex3Raw) : null;

      if (!/^#[0-9a-fA-F]{6}$/.test(hex1)) {
        return R.error('Invalid hex color. Use format like `#ff5733`.');
      }
      if (hex2 && !/^#[0-9a-fA-F]{6}$/.test(hex2)) {
        return R.error('Invalid secondary hex color. Use format like `#0000ff`.');
      }
      if (hex3 && !/^#[0-9a-fA-F]{6}$/.test(hex3)) {
        return R.error('Invalid tertiary hex color. Use format like `#00ff00`.');
      }
      if (hex3 && !hex2) {
        return R.error('Tertiary color requires a secondary color.');
      }

      const role = interaction.guild.roles.cache.get(roleId);
      if (!role || !role.editable) {
        return R.error('This role can no longer be edited.');
      }

      const roleName = role.name || 'Unknown';

      return {
        type: 'ASYNC_RESULT',
        execute: async (): Promise<InteractionResult> => {
          let previewBuffer: Buffer;
          try {
            previewBuffer = await generatePreview(
              interaction.user.displayAvatarURL({ extension: 'png', size: 4096 }),
              interaction.member.displayName || interaction.user.username,
              hex1,
              hex2
            );
          } catch {
            return { type: 'ERROR', message: 'Failed to generate preview.' };
          }

          const file = new AttachmentBuilder(previewBuffer, { name: 'preview.png' });

          const colorParts = [roleId, hex1.replace('#', '')];
          if (hex2) colorParts.push(hex2.replace('#', ''));
          if (hex3) colorParts.push(hex3.replace('#', ''));

          const container = buildPreviewContainer(interaction.user.id, hex1, roleId, roleName, null, hex2, hex3)
            .addActionRowComponents((row: any) =>
              row.setComponents(buildActionSelect(interaction.user.id, roleId))
            )
            .addActionRowComponents((row: any) =>
              row.setComponents(
                new ButtonBuilder()
                  .setCustomId(cidRole('confirm', interaction.user.id, ...colorParts))
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel('CONFIRM'),
                new ButtonBuilder()
                  .setCustomId(cidRole('cancel', interaction.user.id))
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel('CANCEL')
              )
            );

          try {
            const channel = interaction.channel;
            if (!channel) return { type: 'ERROR', message: 'Channel not found.' };
            const msg = await channel.messages.fetch(messageId);
            await msg.edit({ components: [container], files: [file], allowedMentions: { roles: [] } });
          } catch {
            return { type: 'ERROR', message: 'Failed to update preview.' };
          }

          await interaction.deleteReply().catch(() => {});
          return { type: 'IGNORE' };
        }
      };
    }

    if (action === 'namemodal' && interaction.isModalSubmit()) {
      const [roleId, messageId] = data;
      if (!roleId) return R.error('Select a role first.');

      const name = interaction.fields.getTextInputValue('name').trim();
      if (name.length < 1 || name.length > 100) {
        return R.error('Role name must be between 1 and 100 characters.');
      }

      return {
        type: 'ASYNC_RESULT',
        execute: async (): Promise<InteractionResult> => {
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return { type: 'ERROR', message: 'This role can no longer be edited.' };
          }

          try {
            await role.setName(name, `Name changed by ${interaction.user.tag}`);
          } catch {
            return { type: 'ERROR', message: 'Failed to update role name.' };
          }

          const container = buildResultContainer(
            `✅ <@&${roleId}> name changed to **${name}**`
          );

          try {
            const msg = await interaction.channel.messages.fetch(messageId);
            await msg.edit({ components: [container], allowedMentions: { roles: [] } });
          } catch {
            return { type: 'ERROR', message: 'Failed to update message.' };
          }

          await interaction.deleteReply().catch(() => {});
          return { type: 'IGNORE' };
        }
      };
    }

    if (action === 'iconmodal' && interaction.isModalSubmit()) {
      const [roleId, messageId] = data;
      if (!roleId) return R.error('Select a role first.');

      const input = interaction.fields.getTextInputValue('icon').trim();
      if (!input) return R.error('Please provide an icon input.');

      return {
        type: 'ASYNC_RESULT',
        execute: async (): Promise<InteractionResult> => {
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return { type: 'ERROR', message: 'This role can no longer be edited.' };
          }

          try {
            if (!input.startsWith('http')) {
              return { type: 'ERROR', message: 'Invalid input. Provide an image URL starting with http.' };
            }
            const res = await fetch(input);
            if (!res.ok) return { type: 'ERROR', message: 'Failed to fetch image from URL.' };
            const mime = res.headers.get('content-type') || 'image/png';
            if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime!)) {
              return { type: 'ERROR', message: 'Unsupported image format. Use PNG, JPEG, GIF, or WebP.' };
            }
            const buf = Buffer.from(await res.arrayBuffer());
            const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
            await role.setIcon(dataUri, `Icon changed by ${interaction.user.tag}`);
          } catch {
            return { type: 'ERROR', message: 'Failed to update role icon.' };
          }

          const container = buildResultContainer(
            `✅ <@&${roleId}> icon updated.`
          );

          try {
            const msg = await interaction.channel.messages.fetch(messageId);
            await msg.edit({ components: [container], allowedMentions: { roles: [] } });
          } catch {
            return { type: 'ERROR', message: 'Failed to update message.' };
          }

          await interaction.deleteReply().catch(() => {});
          return { type: 'IGNORE' };
        }
      };
    }

    if (action === 'confirm' && interaction.isButton()) {
      if (data.length < 2) return R.error('Select a role and set a color first.');

      const [roleId, hex, hex2, hex3] = data;
      if (!roleId || !hex) return R.error('Select a role and set a color first.');

      const role = interaction.guild.roles.cache.get(roleId);
      if (!role || !role.editable) {
        return R.error('This role can no longer be edited.');
      }

      const botMember = interaction.guild.members.me;
      if (!botMember) return R.error('Bot not found in guild.');
      if (role.comparePositionTo(botMember.roles.highest) >= 0) {
        return R.error('This role is above my highest role.');
      }

      if (hex3) {
        if (!interaction.guild.features.includes('ENHANCED_ROLE_COLORS')) {
          return R.error('This server does not support gradient role colors.');
        }
        try {
          await role.setColors({
            primaryColor: 11127295,
            secondaryColor: 16759788,
            tertiaryColor: 16761760
          }, `Color changed by ${interaction.user.tag}`);
        } catch {
          return R.error('Failed to update role color.');
        }
        const container = buildResultContainer(
          `✅ <@&${roleId}> holographic style set to **#${hex.toUpperCase()} → #${hex2!.toUpperCase()} → #${hex3.toUpperCase()}**`
        );
        return {
          type: 'UPDATE',
          components: [container],
          allowedMentions: { roles: [] }
        } as InteractionResult;
      }

      if (hex2) {
        if (!interaction.guild.features.includes('ENHANCED_ROLE_COLORS')) {
          return R.error('This server does not support gradient role colors.');
        }
        try {
          await role.setColors({
            primaryColor: `#${hex}`,
            secondaryColor: `#${hex2}`
          }, `Color changed by ${interaction.user.tag}`);
        } catch {
          return R.error('Failed to update role color.');
        }
        const container = buildResultContainer(
          `✅ <@&${roleId}> gradient set to **#${hex.toUpperCase()} → #${hex2.toUpperCase()}**`
        );
        return {
          type: 'UPDATE',
          components: [container],
          allowedMentions: { roles: [] }
        } as InteractionResult;
      }

      const appliedHex = '#' + hex;
      try {
        await role.setColors({ primaryColor: appliedHex }, `Color changed by ${interaction.user.tag}`);
      } catch {
        return R.error('Failed to update role color.');
      }

      const colorName = hexToColorName(appliedHex);
      const container = buildResultContainer(
        `✅ <@&${roleId}> color set to **${appliedHex.toUpperCase()}** (${colorName})`
      );

      return {
        type: 'UPDATE',
        components: [container],
        allowedMentions: { roles: [] }
      } as InteractionResult;
    }

    if (action === 'cancel' && interaction.isButton()) {
      return {
        type: 'ASYNC_RESULT',
        execute: async (): Promise<InteractionResult> => {
          try {
            const msg = await interaction.channel.messages.fetch(interaction.message.id);
            await msg.delete();
          } catch {}
          return { type: 'IGNORE' };
        }
      };
    }

    return R.ignore();
  }
};
