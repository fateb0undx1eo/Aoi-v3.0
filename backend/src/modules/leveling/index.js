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
  background_color: '#101212',
  panel_color: '#151716',
  panel_border_color: '#2A2D2B',
  display_name_color: '#FFFFFF',
  username_color: '#9A9A9A',
  rank_color: '#FFFFFF',
  rank_label_color: '#FF1717',
  progress_track_color: '#2B2527',
  progress_start_color: '#FF1212',
  progress_end_color: '#FF4141',
  progress_text_color: '#FF1717',
  stat_card_color: '#070708',
  stat_label_color: '#A0A0A0',
  stat_value_color: '#FFFFFF',
  status_color: '#7DFF8D',
  grid_color: '#252A28'
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
  ctx.globalAlpha = 0.52;
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
  const height = 400;
  const progressWidth = Math.round(540 * stats.progress);
  const displayName = (user.globalName || user.displayName || user.username || 'AOI USER').toUpperCase();
  const username = user.username;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const progressGradient = createProgressGradient(ctx, 320, 140, 540, config);

  ctx.fillStyle = config.background_color;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, config.grid_color);

  const ambientGlow = ctx.createRadialGradient(790, 110, 30, 790, 110, 360);
  ambientGlow.addColorStop(0, hexToRgba(config.progress_start_color, 0.26));
  ambientGlow.addColorStop(1, hexToRgba(config.progress_start_color, 0));
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(450, 0, 450, height);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  fillRoundedRect(ctx, 24, 25, 262, 350, 24, hexToRgba(config.panel_color, 0.78));
  ctx.restore();
  strokeRoundedRect(ctx, 24, 25, 262, 350, 24, hexToRgba(config.panel_border_color, 0.82));

  ctx.save();
  ctx.shadowColor = config.progress_start_color;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = config.progress_start_color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(155, 112, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(155, 112, 68, 0, Math.PI * 2);
    ctx.clip();
    drawCoverImage(ctx, avatar, 87, 44, 136, 136);
    ctx.restore();
  } else {
    drawAvatarFallback(ctx, 155, 112, 68, user, config);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = config.rank_color;
  ctx.font = '900 68px "Arial Rounded MT Bold", "Trebuchet MS", Arial';
  ctx.fillText(`#${stats.rank}`, 155, 240);
  ctx.fillStyle = config.rank_label_color;
  ctx.font = '400 16px Arial';
  ctx.fillText('GLOBAL RANK', 155, 265);

  ctx.save();
  ctx.globalAlpha = 0.16;
  fillRoundedRect(ctx, 84, 326, 142, 36, 18, config.status_color);
  ctx.restore();
  strokeRoundedRect(ctx, 84, 326, 142, 36, 18, config.status_color, 1.4);
  ctx.fillStyle = config.status_color;
  ctx.font = '400 16px Arial';
  ctx.fillText('SUPER ACTIVE', 155, 350);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.display_name_color;
  ctx.font = '900 42px "Arial Rounded MT Bold", "Trebuchet MS", Arial';
  drawTextFit(ctx, displayName, 320, 80, 500);

  ctx.fillStyle = config.stat_label_color;
  ctx.font = '400 16px Arial';
  ctx.fillText('WEEKLY PROGRESS', 320, 125);

  ctx.textAlign = 'right';
  ctx.fillStyle = config.progress_text_color;
  ctx.font = '400 16px Arial';
  ctx.fillText(`${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`, 860, 125);

  fillRoundedRect(ctx, 320, 140, 540, 16, 8, hexToRgba(config.progress_track_color, 0.86));
  ctx.save();
  ctx.shadowColor = config.progress_start_color;
  ctx.shadowBlur = 24;
  fillRoundedRect(ctx, 320, 140, progressWidth, 16, 8, progressGradient);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = config.username_color;
  ctx.font = '400 14px Arial';
  ctx.fillText(`${stats.remaining} more for next role`, 320, 175);

  drawStatCard(ctx, {
    x: 320,
    y: 220,
    label: 'DAILY MSGS',
    value: compactNumber(stats.daily),
    raw: stats.daily.toLocaleString(),
    icon: 'chat',
    config,
    progressGradient
  });
  drawStatCard(ctx, {
    x: 600,
    y: 220,
    label: 'LIFETIME',
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
  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  fillRoundedRect(ctx, x, y, 260, 120, 10, hexToRgba(config.stat_card_color, 0.72));
  ctx.restore();

  if (icon === 'chat') {
    drawChatIcon(ctx, x + 200, y + 58, config.panel_border_color);
  } else {
    drawTrophyIcon(ctx, x + 200, y + 58, config.panel_border_color);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = config.stat_label_color;
  ctx.font = '400 16px Arial';
  ctx.fillText(label, x + 20, y + 35);
  ctx.fillStyle = config.stat_value_color;
  ctx.font = '900 36px "Arial Rounded MT Bold", "Trebuchet MS", Arial';
  ctx.fillText(value, x + 20, y + 76);
  ctx.fillStyle = config.username_color;
  ctx.font = '400 16px Arial';
  ctx.fillText(raw, x + 20, y + 100);
}

function drawChatIcon(ctx, x, y, color) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 5, y + 15, 10, 18);
  ctx.restore();
}

function drawTrophyIcon(ctx, x, y, color) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  roundedRect(ctx, x - 16, y - 22, 32, 30, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 8);
  ctx.lineTo(x + 10, y + 8);
  ctx.lineTo(x + 5, y + 22);
  ctx.lineTo(x - 5, y + 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 17, y + 24, 34, 5);
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
