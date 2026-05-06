import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const LEVELING_SCHEMA = {
  type: 'object',
  properties: {
    rank_card: {
      type: 'object',
      properties: {
        background_color: { type: 'string' },
        panel_color: { type: 'string' },
        panel_border_color: { type: 'string' },
        display_name_color: { type: 'string' },
        username_color: { type: 'string' },
        rank_color: { type: 'string' },
        rank_label_color: { type: 'string' },
        progress_track_color: { type: 'string' },
        progress_start_color: { type: 'string' },
        progress_end_color: { type: 'string' },
        progress_text_color: { type: 'string' },
        stat_card_color: { type: 'string' },
        stat_label_color: { type: 'string' },
        stat_value_color: { type: 'string' },
        status_color: { type: 'string' },
        grid_color: { type: 'string' }
      }
    }
  }
};

const DEFAULT_RANK_CARD_CONFIG = Object.freeze({
  background_color: '#0B0D12',
  panel_color: '#12141A',
  panel_border_color: '#8B4DFF',
  display_name_color: '#FFFFFF',
  username_color: '#8E93A1',
  rank_color: '#FFFFFF',
  rank_label_color: '#B24DFF',
  progress_track_color: '#24272E',
  progress_start_color: '#8F38FF',
  progress_end_color: '#B425FF',
  progress_text_color: '#ECEAF7',
  stat_card_color: '#151820',
  stat_label_color: '#9CA0AA',
  stat_value_color: '#FFFFFF',
  status_color: '#23F28A',
  grid_color: '#1D2230'
});

function cleanHex(value, fallback) {
  const text = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toUpperCase() : fallback;
}

function getRankCardConfig(configCache, guildId) {
  const cached = configCache?.getModuleConfig?.(guildId, 'leveling');
  const rankCard = cached?.config?.rank_card ?? {};

  return Object.fromEntries(
    Object.entries(DEFAULT_RANK_CARD_CONFIG).map(([key, fallback]) => [
      key,
      cleanHex(rankCard[key], fallback)
    ])
  );
}

function compactNumber(value) {
  if (value >= 1000) {
    const compact = value / 1000;
    return `${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)}K`;
  }
  return String(value);
}

function getDeterministicStats(userId) {
  const digits = String(userId ?? '').replace(/\D/g, '');
  const seed = Number.parseInt(digits.slice(-6) || '421337', 10);
  const current = 2600 + (seed % 1800);
  const needed = 5000;
  const daily = 800 + (seed % 4200);
  const lifetime = 24000 + (seed % 92000);
  const rank = 1 + (seed % 99);

  return {
    rank,
    current,
    needed,
    remaining: Math.max(needed - current, 0),
    daily,
    lifetime,
    progress: Math.min(current / needed, 1)
  };
}

async function loadUserAvatar(user) {
  const url = user.displayAvatarURL({ extension: 'png', size: 256 });
  const response = await fetch(url);
  if (!response.ok) return null;
  return loadImage(Buffer.from(await response.arrayBuffer()));
}

function roundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth = 1) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function createProgressGradient(ctx, x, y, width, config) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, config.progress_start_color);
  gradient.addColorStop(1, config.progress_end_color);
  return gradient;
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '#000000').replace('#', '');
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawTextFit(ctx, text, x, y, maxWidth) {
  const source = String(text ?? '');
  if (ctx.measureText(source).width <= maxWidth) {
    ctx.fillText(source, x, y);
    return;
  }

  let output = source;
  while (output.length > 1 && ctx.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  ctx.fillText(`${output}...`, x, y);
}

function drawGrid(ctx, width, height, color) {
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAvatarFallback(ctx, x, y, radius, user, config) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  const gradient = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  gradient.addColorStop(0, config.panel_border_color);
  gradient.addColorStop(1, config.progress_track_color);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.fillStyle = config.display_name_color;
  ctx.font = '900 44px "Arial Rounded MT Bold", "Trebuchet MS", Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(user.username || 'A').slice(0, 1).toUpperCase(), x, y + 2);
  ctx.restore();
}

function drawRankCardPng({ user, avatar, config, stats }) {
  const width = 900;
  const height = 360;
  const progressWidth = Math.round(445 * stats.progress);
  const displayName = user.globalName || user.displayName || user.username || 'AOI User';
  const username = user.username;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const progressGradient = createProgressGradient(ctx, 382, 168, 445, config);

  ctx.fillStyle = config.background_color;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, config.grid_color);

  const ambientGlow = ctx.createRadialGradient(735, 60, 30, 735, 60, 330);
  ambientGlow.addColorStop(0, hexToRgba(config.progress_start_color, 0.32));
  ambientGlow.addColorStop(1, hexToRgba(config.progress_start_color, 0));
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(390, 0, 510, height);

  ctx.save();
  ctx.shadowColor = hexToRgba(config.progress_start_color, 0.38);
  ctx.shadowBlur = 26;
  fillRoundedRect(ctx, 160, 35, 702, 287, 13, hexToRgba(config.panel_color, 0.82));
  ctx.restore();
  strokeRoundedRect(ctx, 160, 35, 702, 287, 13, hexToRgba(config.panel_border_color, 0.76), 1.2);

  ctx.save();
  ctx.shadowColor = hexToRgba(config.progress_start_color, 0.58);
  ctx.shadowBlur = 22;
  ctx.strokeStyle = progressGradient;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(260, 128, 67, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = hexToRgba(config.background_color, 0.92);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(260, 128, 60, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(260, 128, 58, 0, Math.PI * 2);
    ctx.clip();
    drawCoverImage(ctx, avatar, 202, 70, 116, 116);
    ctx.restore();
  } else {
    drawAvatarFallback(ctx, 260, 128, 58, user, config);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = config.rank_color;
  ctx.font = '900 55px Arial';
  ctx.fillText(`#${stats.rank}`, 260, 247);
  ctx.fillStyle = config.rank_label_color;
  ctx.font = '700 12px Arial';
  ctx.fillText('GLOBAL RANK', 260, 269);

  ctx.save();
  ctx.globalAlpha = 0.12;
  fillRoundedRect(ctx, 195, 283, 138, 27, 14, config.status_color);
  ctx.restore();
  strokeRoundedRect(ctx, 195, 283, 138, 27, 14, config.status_color, 1.2);
  ctx.fillStyle = config.status_color;
  ctx.font = '800 11px Arial';
  ctx.beginPath();
  ctx.arc(218, 296, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('SUPER ACTIVE', 270, 300);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.display_name_color;
  ctx.font = '900 33px Arial';
  drawTextFit(ctx, displayName, 382, 105, 400);
  ctx.fillStyle = config.username_color;
  ctx.font = '600 13px Arial';
  drawTextFit(ctx, `@${username}`, 382, 128, 360);

  ctx.fillStyle = config.stat_label_color;
  ctx.font = '800 11px Arial';
  ctx.fillText('WEEKLY PROGRESS', 382, 160);

  ctx.textAlign = 'right';
  ctx.fillStyle = config.progress_text_color;
  ctx.font = '900 13px Arial';
  ctx.fillText(`${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`, 827, 159);

  fillRoundedRect(ctx, 382, 168, 445, 18, 9, hexToRgba(config.progress_track_color, 0.9));
  ctx.save();
  ctx.shadowColor = config.progress_start_color;
  ctx.shadowBlur = 16;
  fillRoundedRect(ctx, 382, 168, progressWidth, 18, 9, progressGradient);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = config.username_color;
  ctx.font = '600 12px Arial';
  ctx.fillText(`${compactNumber(stats.remaining)} more XP for next role`, 382, 205);

  drawStatCard(ctx, {
    x: 382,
    y: 226,
    label: 'DAILY XP',
    value: compactNumber(stats.daily),
    raw: stats.daily.toLocaleString(),
    icon: 'chat',
    config,
    progressGradient
  });
  drawStatCard(ctx, {
    x: 617,
    y: 226,
    label: 'LIFETIME XP',
    value: compactNumber(stats.lifetime),
    raw: stats.lifetime.toLocaleString(),
    icon: 'trophy',
    config,
    progressGradient
  });

  return canvas.toBuffer('image/png');
}

function drawStatCard(ctx, { x, y, label, value, raw, icon, config }) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.46)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  fillRoundedRect(ctx, x, y, 213, 96, 12, hexToRgba(config.stat_card_color, 0.75));
  ctx.restore();
  strokeRoundedRect(ctx, x, y, 213, 96, 12, hexToRgba(config.panel_border_color, 0.18));

  if (icon === 'chat') {
    drawChatIcon(ctx, x + 31, y + 27, config.progress_start_color);
  } else {
    drawTrophyIcon(ctx, x + 31, y + 28, config.progress_start_color);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = config.stat_label_color;
  ctx.font = '800 12px Arial';
  ctx.fillText(label, x + 60, y + 31);
  ctx.fillStyle = config.stat_value_color;
  ctx.font = '900 32px Arial';
  ctx.fillText(value, x + 60, y + 67);
  ctx.fillStyle = config.username_color;
  ctx.font = '700 13px Arial';
  ctx.fillText(raw, x + 60, y + 86);
}

function drawChatIcon(ctx, x, y, color) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  roundedRect(ctx, x - 11, y - 10, 22, 18, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 8);
  ctx.lineTo(x - 7, y + 15);
  ctx.lineTo(x + 4, y + 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - 5, y - 1, 1.2, 0, Math.PI * 2);
  ctx.arc(x, y - 1, 1.2, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 1, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawTrophyIcon(ctx, x, y, color) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  roundedRect(ctx, x - 10, y - 11, 20, 17, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 7);
  ctx.quadraticCurveTo(x - 20, y - 1, x - 11, y + 2);
  ctx.moveTo(x + 16, y - 7);
  ctx.quadraticCurveTo(x + 20, y - 1, x + 11, y + 2);
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x, y + 17);
  ctx.moveTo(x - 10, y + 17);
  ctx.lineTo(x + 10, y + 17);
  ctx.stroke();
  ctx.restore();
}

async function buildRankAttachment(user, config) {
  const stats = getDeterministicStats(user.id);
  const avatar = await loadUserAvatar(user).catch(() => null);
  const png = drawRankCardPng({ user, avatar, config, stats });
  return new AttachmentBuilder(png, { name: `rank-${user.id}.png` });
}

export default {
  name: 'leveling',
  configSchema: LEVELING_SCHEMA,
  commands: [
    {
      name: 'rank',
      description: 'Show your rank card',
      async execute(interaction, { configCache }) {
        const config = getRankCardConfig(configCache, interaction.guildId);
        const attachment = await buildRankAttachment(interaction.user, config);
        await interaction.editReply({ files: [attachment] });
      }
    }
  ],
  events: []
};
