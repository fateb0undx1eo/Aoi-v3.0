import {
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

const FONT_DIR = path.join(process.cwd(), 'src', 'modules', 'leveling', 'assets', 'fonts');

function loadFonts() {
  try {
    if (!fs.existsSync(FONT_DIR)) return;
    const full = path.join(FONT_DIR, 'Inter_24pt-Regular.ttf');
    if (fs.existsSync(full)) registerFont(full, { family: 'Inter', weight: '400' });
    const bold = path.join(FONT_DIR, 'Inter_24pt-SemiBold.ttf');
    if (fs.existsSync(bold)) registerFont(bold, { family: 'Inter', weight: '600' });
  } catch {}
}
loadFonts();

const FONT = 'Inter, "gg sans", "Helvetica Neue", Arial, sans-serif';

function formatTimestamp() {
  const now = new Date();
  const time = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `Today at ${time}`;
}

async function generatePreview(avatarUrl, username, hexColor) {
  const width = 420;
  const height = 110;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#313338';
  ctx.fillRect(0, 0, width, height);

  let avatar;
  try {
    const res = await fetch(avatarUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    avatar = await loadImage(buf);
  } catch {
    avatar = null;
  }

  const avatarSize = 40;
  const avatarX = 16;
  const avatarY = 16;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#5865F2';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  const textX = avatarX + avatarSize + 12;
  const textY = 22;

  ctx.font = '600 16px ' + FONT;
  ctx.fillStyle = `#${hexColor.replace('#', '')}`;
  ctx.fillText(username, textX, textY + 12);

  ctx.font = '400 12px ' + FONT;
  ctx.fillStyle = '#949ba4';
  const timestamp = formatTimestamp();
  const nameWidth = ctx.measureText(username).width;
  ctx.fillText(timestamp, textX + nameWidth + 10, textY + 12);

  ctx.font = '400 16px ' + FONT;
  ctx.fillStyle = '#dbdee1';
  ctx.fillText('Hello I am on Discord', textX, textY + 48);

  return canvas.toBuffer('image/png');
}

const PREFIX = 'rc';
const sessions = new Map();

function cid(action, userId) {
  return `${PREFIX}:${action}:${userId}`;
}

function parseCid(customId) {
  const parts = customId.split(':');
  if (parts[0] !== PREFIX || parts.length < 3) return null;
  return { action: parts[1], userId: parts[2] };
}

function buildRoleSelect(userId, guild) {
  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id && r.editable)
    .sort((a, b) => b.position - a.position)
    .first(25);

  return new StringSelectMenuBuilder()
    .setCustomId(cid('role', userId))
    .setPlaceholder('Select a role...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      ...roles.map(r =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.name)
          .setValue(r.id)
          .setDescription(`#${r.hexColor}`)
      )
    );
}

function buildInitialContainer(userId, guild, confirmDisabled) {
  return new ContainerBuilder()
    .setAccentColor(0x2b2d31)
    .addTextDisplayComponents(td =>
      td.setContent('# Role Color Editor')
    )
    .addSectionComponents(section =>
      section.addTextDisplayComponents(td =>
        td.setContent('Select a role, set a hex color, then Confirm to apply.')
      )
    )
    .addActionRowComponents(row =>
      row.setComponents(buildRoleSelect(userId, guild))
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(cid('color', userId))
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Set Color')
          .setEmoji('🎨'),
        new ButtonBuilder()
          .setCustomId(cid('confirm', userId))
          .setStyle(ButtonStyle.Success)
          .setLabel('Confirm')
          .setDisabled(confirmDisabled),
        new ButtonBuilder()
          .setCustomId(cid('cancel', userId))
          .setStyle(ButtonStyle.Danger)
          .setLabel('Cancel')
      )
    );
}

function buildPreviewContainer(userId, guild, hex, roleName) {
  return new ContainerBuilder()
    .setAccentColor(parseInt(hex.replace('#', ''), 16) || 0x2b2d31)
    .addTextDisplayComponents(td =>
      td.setContent('# Role Color Editor')
    )
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td =>
          td.setContent(`**Role:** @${roleName}\n**Hex:** ${hex.toUpperCase()}`)
        )
        .setThumbnailAccessory(thumb =>
          thumb
            .setURL('attachment://preview.png')
            .setDescription('Role color preview')
        )
    )
    .addActionRowComponents(row =>
      row.setComponents(buildRoleSelect(userId, guild))
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(cid('color', userId))
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Set Color')
          .setEmoji('🎨'),
        new ButtonBuilder()
          .setCustomId(cid('confirm', userId))
          .setStyle(ButtonStyle.Success)
          .setLabel('Confirm'),
        new ButtonBuilder()
          .setCustomId(cid('cancel', userId))
          .setStyle(ButtonStyle.Danger)
          .setLabel('Cancel')
      )
    );
}

function buildResultContainer(accentColor, message) {
  return new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(td =>
      td.setContent('# Role Color Editor')
    )
    .addSectionComponents(section =>
      section.addTextDisplayComponents(td =>
        td.setContent(message)
      )
    );
}

const ROLE_COLOR_SCHEMA = { type: 'object', properties: {} };

export default {
  name: 'rolecolor',
  configSchema: ROLE_COLOR_SCHEMA,
  commands: [
    {
      name: 'role-color',
      description: "Edit a role's color with a live preview",
      async execute(interaction, context) {
        const member = interaction.member;
        if (!member.permissions.has('ManageRoles')) {
          await interaction.editReply({ content: 'You need the Manage Roles permission.', components: [] });
          return;
        }

        const guild = interaction.guild;
        const roles = guild.roles.cache
          .filter(r => r.id !== guild.id && r.editable && r.comparePositionTo(guild.members.me.roles.highest) < 0)
          .sort((a, b) => b.position - a.position);

        if (roles.size === 0) {
          await interaction.editReply({ content: 'No editable roles found.', components: [] });
          return;
        }

        const userId = interaction.user.id;
        sessions.set(userId, { roleId: null, hex: null, active: true });

        const container = buildInitialContainer(userId, guild, true);

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] }
        });
      }
    }
  ],
  events: [
    {
      name: 'interactionCreate',
      async execute(interaction, { services, discordClient }) {
        if (!interaction.customId) return;
        const parsed = parseCid(interaction.customId);
        if (!parsed) return;

        const { action, userId } = parsed;

        if (interaction.user.id !== userId) {
          await interaction.reply({ content: 'This panel belongs to another user.', ephemeral: true });
          return;
        }

        const session = sessions.get(userId);
        if (!session || !session.active) {
          await interaction.reply({ content: 'This session has expired. Run /role-color again.', ephemeral: true });
          return;
        }

        if (action === 'role' && interaction.isStringSelectMenu()) {
          const roleId = interaction.values[0];
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            await interaction.reply({ content: 'This role cannot be edited.', ephemeral: true });
            return;
          }

          session.roleId = roleId;

          const container = buildInitialContainer(interaction.user.id, interaction.guild, false);
          await interaction.update({ components: [container] });
          return;
        }

        if (action === 'color' && interaction.isButton()) {
          const modal = new ModalBuilder()
            .setTitle('Set Role Color')
            .setCustomId(cid('modal', userId))
            .addComponents(
              new ActionRowBuilder()
                .addComponents(
                  new TextInputBuilder()
                    .setCustomId('hex')
                    .setLabel('Hex Color')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#ff5733')
                    .setRequired(true)
                    .setMinLength(4)
                    .setMaxLength(7)
                )
            );

          await interaction.showModal(modal);
          return;
        }

        if (action === 'modal' && interaction.isModalSubmit()) {
          const hexRaw = interaction.fields.getTextInputValue('hex').trim();
          const hex = hexRaw.startsWith('#') ? hexRaw : '#' + hexRaw;

          if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
            await interaction.reply({ content: 'Invalid hex color. Use format like `#ff5733`.', ephemeral: true });
            return;
          }

          if (!session.roleId) {
            await interaction.reply({ content: 'Select a role first.', ephemeral: true });
            return;
          }

          session.hex = hex;

          let previewBuffer;
          try {
            previewBuffer = await generatePreview(
              interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
              interaction.user.displayName || interaction.user.username,
              hex
            );
          } catch {
            await interaction.reply({ content: 'Failed to generate preview.', ephemeral: true });
            return;
          }

          const file = new AttachmentBuilder(previewBuffer, { name: 'preview.png' });
          const role = interaction.guild.roles.cache.get(session.roleId);
          const roleName = role?.name || 'Unknown';

          const container = buildPreviewContainer(interaction.user.id, interaction.guild, hex, roleName);

          try {
            await interaction.message.edit({ components: [container], files: [file] });
          } catch {
            await interaction.reply({ content: 'Failed to update preview.', ephemeral: true });
          }
          return;
        }

        if (action === 'confirm' && interaction.isButton()) {
          if (!session.roleId || !session.hex) {
            await interaction.reply({ content: 'Select a role and set a color first.', ephemeral: true });
            return;
          }

          const role = interaction.guild.roles.cache.get(session.roleId);
          if (!role || !role.editable) {
            await interaction.reply({ content: 'This role can no longer be edited.', ephemeral: true });
            return;
          }

          if (role.comparePositionTo(interaction.guild.members.me.roles.highest) >= 0) {
            await interaction.reply({ content: 'This role is above my highest role.', ephemeral: true });
            return;
          }

          const appliedHex = session.hex;

          try {
            await role.setColor(appliedHex, `Color changed by ${interaction.user.tag}`);
          } catch {
            await interaction.reply({ content: 'Failed to update role color.', ephemeral: true });
            return;
          }

          session.active = false;
          sessions.delete(userId);

          const container = buildResultContainer(
            parseInt(appliedHex.replace('#', ''), 16) || 0x2b2d31,
            `✅ Role color updated to **${appliedHex.toUpperCase()}**`
          );

          await interaction.update({ components: [container] });
          return;
        }

        if (action === 'cancel' && interaction.isButton()) {
          session.active = false;
          sessions.delete(userId);

          const container = buildResultContainer(0x2b2d31, '❌ Editor closed.');

          await interaction.update({ components: [container] });
          return;
        }
      }
    }
  ]
};
