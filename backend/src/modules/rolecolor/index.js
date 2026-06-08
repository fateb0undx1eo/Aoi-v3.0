import {
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionsBitField
} from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import chroma from 'chroma-js';

function formatTimestamp() {
  const now = new Date();
  const time = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `Today at ${time}`;
}

const XKCD = [
  [0x000000,'black'],[0xffffff,'white'],[0xdddddd,'light grey'],[0xcccccc,'grey'],[0x333333,'dark grey'],
  [0x111111,'almost black'],[0xff0000,'red'],[0xcc0000,'dark red'],[0x990000,'blood red'],[0x660000,'maroon'],
  [0xff4444,'bright red'],[0xff6666,'pinkish red'],[0xffcccc,'pale red'],[0xff8888,'salmon'],
  [0xffa07a,'light salmon'],[0xff4500,'orangered'],[0xff6347,'tomato'],[0xdc143c,'crimson'],
  [0xb22222,'firebrick'],[0xe60000,'cherry red'],[0xbf0000,'brick red'],[0xc0392b,'rust red'],
  [0xe74c3c,'pomegranate'],[0xff6600,'orange'],[0xff9900,'bright orange'],[0xffa500,'tangerine'],
  [0xff8c00,'dark orange'],[0xff7f50,'coral'],[0xffb347,'pastel orange'],[0xffd700,'gold'],
  [0xffcc00,'yellow orange'],[0xffbf00,'amber'],[0xf39c12,'honey'],[0xffff00,'yellow'],
  [0xffff66,'light yellow'],[0xffff99,'pale yellow'],[0xfffccc,'cream'],[0xfffacd,'lemon chiffon'],
  [0xf1c40f,'sunflower'],[0xf7dc6f,'butter'],[0xf9e79f,'pale gold'],[0xf4d03f,'banana'],
  [0xccff00,'chartreuse'],[0xadff2f,'greenyellow'],[0x7fff00,'lime'],[0x00ff00,'neon green'],
  [0x32cd32,'lime green'],[0x00cc00,'vibrant green'],[0x009900,'green'],[0x006600,'dark green'],
  [0x228b22,'forest green'],[0x2ecc71,'emerald'],[0x27ae60,'sea green'],[0x1abc9c,'teal green'],
  [0x2e8b57,'seaweed'],[0x3cb371,'medium green'],[0x66cd00,'bright green'],[0x98fb98,'pale green'],
  [0x90ee90,'light green'],[0x8fbc8f,'dark sea green'],[0x556b2f,'olive green'],[0x6b8e23,'olive drab'],
  [0x9acd32,'yellow green'],[0x00ff80,'spring green'],[0x00fa9a,'medium spring green'],[0x7fffd4,'aquamarine'],
  [0x00ffff,'cyan'],[0x00cccc,'teal'],[0x008080,'dark teal'],[0x0088ff,'ocean blue'],
  [0x00bfff,'deep sky blue'],[0x87ceeb,'sky blue'],[0x87cefa,'light sky blue'],[0xadd8e6,'light blue'],
  [0xb0e0e6,'powder blue'],[0x00aaff,'azure'],[0x0077ff,'blue'],[0x0000ff,'bright blue'],
  [0x0000cc,'medium blue'],[0x000099,'dark blue'],[0x000066,'navy'],[0x1e90ff,'dodger blue'],
  [0x4169e1,'royal blue'],[0x4682b4,'steel blue'],[0x5f9ea0,'cadet blue'],[0x6495ed,'cornflower'],
  [0x34495e,'dark slate'],[0x2c3e50,'midnight'],[0x2980b9,'ocean'],[0x3498db,'cerulean'],
  [0x8e44ad,'purple'],[0x9b59b6,'amethyst'],[0x800080,'dark purple'],[0x4b0082,'indigo'],
  [0x6a5acd,'slate blue'],[0x483d8b,'dark slate blue'],[0x7b68ee,'medium slate blue'],[0x9370db,'medium purple'],
  [0x8a2be2,'blue violet'],[0x9400d3,'dark violet'],[0x9932cc,'dark orchid'],[0xba55d3,'medium orchid'],
  [0xda70d6,'orchid'],[0xee82ee,'violet'],[0xdda0dd,'plum'],[0xff00ff,'magenta'],[0xcc00cc,'bright magenta'],
  [0xff1493,'deep pink'],[0xff69b4,'hot pink'],[0xffb6c1,'light pink'],[0xffc0cb,'pink'],
  [0xdb7093,'pale violet red'],[0xc71585,'medium violet red'],[0xe91e63,'raspberry'],
  [0x800000,'burgundy'],[0xa0522d,'sienna'],[0x8b4513,'saddle brown'],[0xd2691e,'chocolate'],
  [0xcd853f,'peru'],[0xdeb887,'burlywood'],[0xd2b48c,'tan'],[0xbc8f8f,'rosy brown'],
  [0xf4a460,'sandy brown'],[0xdaa520,'goldenrod'],[0xb8860b,'dark goldenrod'],[0x8b6914,'dark mustard'],
  [0x964b00,'brown'],[0x6b3a2a,'dark brown'],[0x3e2723,'very dark brown'],[0x8d6e63,'warm brown'],
  [0xa1887f,'dusty brown'],[0x808080,'grey'],[0xa9a9a9,'dark grey'],[0xd3d3d3,'light grey'],
  [0xf5f5f5,'white smoke'],[0xf8f8ff,'ghost white'],[0x95a5a6,'grey blue'],[0x7f8c8d,'greyish'],
  [0xbdc3c7,'silver'],[0xecf0f1,'off white'],[0xfdf5e6,'old lace'],[0xfffaf0,'floral white'],
  [0xfff8e7,'coconut'],[0xe6e6fa,'lavender'],[0xf0f8ff,'alice blue'],[0xf5fffa,'mint'],
  [0xf0ffff,'azure'],[0xfffff0,'ivory'],[0xfaf0e6,'linen'],[0xfff5ee,'seashell'],
  [0xfff0f5,'lavender blush'],[0xffe4e1,'misty rose'],[0xffdead,'navajo white'],[0xf5deb3,'wheat'],
  [0xffe4c4,'bisque'],[0xf0e68c,'khaki'],[0xbdb76b,'dark khaki'],[0xeee8aa,'pale goldenrod'],
  [0xf5f5dc,'beige'],[0xffffe0,'light yellow'],[0xf0fff0,'honeydew'],[0xffe5b4,'peach'],
  [0xffdab9,'peach puff'],[0xffcba4,'apricot'],[0xffb07c,'cantaloupe'],[0xfa8072,'salmon'],
  [0xe9967a,'dark salmon'],[0xf08080,'light coral'],[0xcd5c5c,'indian red'],[0xc08080,'old rose'],
  [0xe8adad,'rose gold'],[0xfb607f,'rose'],[0xff91a4,'pink rose'],[0xff3855,'watermelon'],
  [0xc41e3a,'cardinal'],[0x960018,'ruby'],[0x800020,'wine'],[0x722f37,'wine red'],
  [0x673147,'aubergine'],[0x7b1113,'cherry'],[0xf19cbb,'candy pink'],[0xff66cc,'pink magenta'],
  [0xe3256b,'razzmatazz'],[0xfe28a2,'persian rose'],[0xde5d83,'blush'],[0xb3446c,'dark rose'],
  [0xdf00ff,'psychedelic purple'],[0xbf00ff,'electric purple'],[0x9900ff,'purple blue'],
  [0x7a5dc7,'lavender purple'],[0x563c5c,'purplish'],[0x301934,'dark purple'],
  [0x191970,'midnight blue'],[0x120a8f,'ultramarine'],[0x000080,'navy blue'],[0x002366,'royal navy'],
  [0x003153,'prussian blue'],[0x004b87,'cobalt'],[0x007ba7,'cerulean'],[0x00a86b,'jade'],
  [0x00ff7f,'spring green'],[0x50c878,'emerald green'],[0x4fffb0,'mint green'],[0x00ced1,'turquoise'],
  [0x40e0d0,'bright turquoise'],[0x48d1cc,'medium turquoise'],[0x20b2aa,'light sea green'],
  [0x008b8b,'dark cyan'],[0x006994,'blue green'],[0x005b96,'peacock blue'],[0x0f52ba,'sapphire'],
  [0x1434a4,'egyptian blue'],[0x7ff000,'lime green'],[0xccff66,'light neon green'],
  [0x808000,'olive'],[0x004b23,'dark forest green'],[0x002200,'pine green'],[0x1b4d3e,'dark green blue'],
  [0xd4af37,'metallic gold'],[0xaa6c39,'bronze'],[0x8b8589,'pewter'],[0x6699cc,'blue grey'],
  [0x6082b6,'glaucous'],[0x536872,'slate grey'],[0x36454f,'charcoal'],[0x28282b,'onyx'],
  [0x353839,'dark charcoal'],[0x8c92ac,'grey purple'],[0x71706e,'warm grey'],[0xbbb8b0,'cool grey'],
  [0xdcdcdc,'gainsboro'],[0xefdfbb,'dusty white'],[0xf1e7d0,'eggshell'],[0xf7efe2,'bone'],
  [0xe8d5b7,'almond'],[0xeddcc9,'ivory'],[0xf6e9d7,'cream']
].map(([h, n]) => [chroma(h), n]);

function hexToColorName(hex) {
  const target = chroma(hex.replace('#', ''));
  let closest = hex.toUpperCase();
  let minDist = Infinity;
  for (const [color, name] of XKCD) {
    const d = chroma.deltaE(target, color);
    if (d < minDist) { minDist = d; closest = name; }
  }
  return closest.charAt(0).toUpperCase() + closest.slice(1);
}

async function generatePreview(avatarUrl, username, hexColor, hex2Color) {
  const width = 480;
  const height = 130;
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

  const avatarSize = 48;
  const avatarX = 19;
  const avatarY = 39;

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

  const textX = avatarX + avatarSize + 14;
  const textY = 53;

  const hex = hexColor.replace('#', '');
  const timestamp = formatTimestamp();

  ctx.font = '400 14px sans-serif';
  const tsWidth = ctx.measureText(timestamp).width;
  const gap = 10;
  const rightMargin = 20;
  const maxNameWidth = width - textX - tsWidth - gap - rightMargin;

  ctx.font = '600 18px sans-serif';
  let displayName = username;
  let nameWidth = ctx.measureText(displayName).width;
  if (nameWidth > maxNameWidth) {
    while (ctx.measureText(displayName + '...').width > maxNameWidth && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '...';
    nameWidth = ctx.measureText(displayName).width;
  }

  if (hex2Color) {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, hexColor);
    gradient.addColorStop(1, hex2Color);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = `#${hex}`;
  }
  ctx.fillText(displayName, textX, textY);

  ctx.font = '400 14px sans-serif';
  ctx.fillStyle = '#949ba4';
  ctx.fillText(timestamp, textX + nameWidth + gap, textY);

  ctx.font = '400 18px sans-serif';
  ctx.fillStyle = '#dbdee1';
  ctx.fillText('Hello I am on Discord', textX, textY + 33);

  return canvas.toBuffer('image/png');
}

const PREFIX = 'rc';

function cid(action, userId, ...extra) {
  return [PREFIX, action, userId, ...extra].join(':');
}

function parseCid(customId) {
  const parts = customId.split(':');
  if (parts[0] !== PREFIX || parts.length < 3) return null;
  return { action: parts[1], userId: parts[2], data: parts.slice(3) };
}

function buildRoleSelect(userId) {
  return new RoleSelectMenuBuilder()
    .setCustomId(cid('role', userId))
    .setPlaceholder('Select a role...')
    .setMinValues(1)
    .setMaxValues(1);
}

function buildInitialContainer() {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# Role Color Editor')
    );
}

function buildRoleSelectedContainer(roleName) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# Role Color Editor')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**Role:** @${roleName}`)
    );
}

function buildPreviewContainer(userId, hex, roleId, roleName, colorOverride, hex2) {
  const colorName = colorOverride || hexToColorName(hex);
  const colorText = hex2
    ? `**Gradient:** ${hex.toUpperCase()} → ${hex2.toUpperCase()}`
    : `**Color:** ${colorName}\n**Hex:** ${hex.toUpperCase()}`;
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Role Color Editor')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Role:** <@&${roleId}>\n${colorText}`)
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://preview.png')
      )
    );
}

function buildResultContainer(message) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Role Color Editor')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(message)
    );
}

// ── Result helpers (mirror router helpers for local use) ─────────────
const R = {
  ignore:      ()                             => ({ type: 'IGNORE' }),
  error:       (message)                      => ({ type: 'ERROR', message }),
  editReply:   (content, opts = {})           => ({ type: 'EDIT_REPLY', content, components: opts.components, files: opts.files }),
  update:      (opts = {})                    => ({ type: 'UPDATE', content: opts.content, components: opts.components, files: opts.files, allowedMentions: opts.allowedMentions }),
  modal:       (builder)                      => ({ type: 'MODAL', modal: builder }),
};

const ROLE_COLOR_SCHEMA = { type: 'object', properties: {} };

export default {
  name: 'rolecolor',
  configSchema: ROLE_COLOR_SCHEMA,
  commands: [
    {
      name: 'role-color',
      defer: false,
      description: "Edit a role's color with a live preview",
      ephemeral: false,
      async execute(interaction, context) {
        const member = interaction.member;
        if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return R.error('You need the Manage Roles permission.');
        }

        const guild = interaction.guild;
        const roles = guild.roles.cache
          .filter(r => r.id !== guild.id && r.editable)
          .sort((a, b) => b.position - a.position);

        if (roles.size === 0) {
          return R.error('No editable roles found.');
        }

        const userId = interaction.user.id;

        const container = buildInitialContainer()
          .addActionRowComponents(row =>
            row.setComponents(buildRoleSelect(userId))
          )
          .addActionRowComponents(row =>
            row.setComponents(
              new ButtonBuilder()
                .setCustomId(cid('color', userId))
                .setStyle(ButtonStyle.Secondary)
                .setLabel('COLOR')
                
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(cid('confirm', userId))
                .setStyle(ButtonStyle.Secondary)
                .setLabel('CONFIRM')
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(cid('cancel', userId))
                .setStyle(ButtonStyle.Secondary)
                .setLabel('CANCEL')
            )
          );

        await interaction.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });

        return { type: 'IGNORE' };
      }
    }
  ],
  events: [
    {
      name: 'interactionCreate',
      async execute(interaction) {
        if (interaction.isCommand()) return;
        if (!interaction.customId) return R.ignore();
        const parsed = parseCid(interaction.customId);
        if (!parsed) return R.ignore();

        const { action, userId, data } = parsed;

        if (interaction.user.id !== userId) {
          return R.error('This panel belongs to another user.');
        }

        if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return R.error('You need the Manage Roles permission.');
        }

        if (action === 'role' && interaction.isRoleSelectMenu()) {
          const roleId = interaction.values[0];
          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return R.error('This role cannot be edited.');
          }

          const primaryVal = role.colors?.primaryColor ?? role.color;
          const secondaryVal = role.colors?.secondaryColor ?? 0;
          const hasColor = primaryVal !== 0;
          const previewHex = hasColor ? `#${primaryVal.toString(16).padStart(6, '0')}` : '#ffffff';
          const previewHex2 = secondaryVal ? `#${secondaryVal.toString(16).padStart(6, '0')}` : null;
          const previewBuffer = await generatePreview(
            interaction.user.displayAvatarURL({ extension: 'png', size: 4096 }),
            interaction.member.displayName || interaction.user.username,
            previewHex,
            previewHex2
          );
          const file = new AttachmentBuilder(previewBuffer, { name: 'preview.png' });

          const container = buildPreviewContainer(interaction.user.id, previewHex, roleId, role.name, hasColor ? null : 'Default', previewHex2)
            .addActionRowComponents(row =>
              row.setComponents(buildRoleSelect(interaction.user.id))
            )
            .addActionRowComponents(row =>
              row.setComponents(
                new ButtonBuilder()
                  .setCustomId(cid('color', interaction.user.id, roleId))
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel('COLOR'),
                new ButtonBuilder()
                  .setCustomId(cid('confirm', interaction.user.id, roleId))
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel('CONFIRM')
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId(cid('cancel', interaction.user.id))
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel('CANCEL')
              )
            );
          return R.update({ components: [container], files: [file], allowedMentions: { roles: [] } });
        }

        if (action === 'color' && interaction.isButton()) {
          const roleId = data[0];
          if (!roleId) return R.error('Select a role first.');

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return R.error('This role cannot be edited.');
          }

          const supportsGradient = interaction.guild.features.includes('ENHANCED_ROLE_COLORS');

          const modalRows = [
            new ActionRowBuilder()
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
              new ActionRowBuilder()
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
          }

          const modal = new ModalBuilder()
            .setTitle('Set Role Color')
            .setCustomId(cid('modal', userId, roleId, interaction.message.id))
            .addComponents(...modalRows);
          return R.modal(modal);
        }

        if (action === 'modal' && interaction.isModalSubmit()) {
          const [roleId, messageId] = data;
          if (!roleId) return R.error('Select a role first.');

          const hex1Raw = interaction.fields.getTextInputValue('hex1').trim();
          const hex2Raw = interaction.fields.getField('hex2')?.value?.trim() ?? '';

          const hex1 = hex1Raw.startsWith('#') ? hex1Raw : '#' + hex1Raw;
          const hex2 = hex2Raw ? (hex2Raw.startsWith('#') ? hex2Raw : '#' + hex2Raw) : null;

          if (!/^#[0-9a-fA-F]{6}$/.test(hex1)) {
            return R.error('Invalid hex color. Use format like `#ff5733`.');
          }
          if (hex2 && !/^#[0-9a-fA-F]{6}$/.test(hex2)) {
            return R.error('Invalid secondary hex color. Use format like `#0000ff`.');
          }

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return R.error('This role can no longer be edited.');
          }

          const roleName = role.name || 'Unknown';

          return {
            type: 'ASYNC_RESULT',
            execute: async () => {
              let previewBuffer;
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

                const container = buildPreviewContainer(interaction.user.id, hex1, roleId, roleName, null, hex2)
                .addActionRowComponents(row =>
                  row.setComponents(buildRoleSelect(interaction.user.id))
                )
                .addActionRowComponents(row =>
                  row.setComponents(
                    new ButtonBuilder()
                      .setCustomId(cid('color', interaction.user.id, roleId))
                      .setStyle(ButtonStyle.Secondary)
                      .setLabel('COLOR')
                      ,
                    new ButtonBuilder()
                      .setCustomId(cid('confirm', interaction.user.id, roleId, hex1.replace('#', ''), hex2 ? hex2.replace('#', '') : ''))
                      .setStyle(ButtonStyle.Secondary)
                      .setLabel('CONFIRM'),
                    new ButtonBuilder()
                      .setCustomId(cid('cancel', interaction.user.id))
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

        if (action === 'confirm' && interaction.isButton()) {
          const [roleId, hex, hex2] = data;
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
            };
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
          };
        }

        if (action === 'cancel' && interaction.isButton()) {
          return {
            type: 'ASYNC_RESULT',
            execute: async () => {
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
    }
  ]
};
