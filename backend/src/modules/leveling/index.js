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
  background_color: '#090A10',
  panel_color: '#181920',
  panel_border_color: '#282A33',
  display_name_color: '#FFFFFF',
  username_color: '#858B9A',
  rank_color: '#FFFFFF',
  rank_label_color: '#D62BFF',
  progress_track_color: '#1A1B23',
  progress_start_color: '#A414F5',
  progress_end_color: '#E363E9',
  progress_text_color: '#E9ECF5',
  stat_card_color: '#191A21',
  stat_label_color: '#878C9A',
  stat_value_color: '#FFFFFF',
  status_color: '#28D56C',
  grid_color: '#20222B'
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
  ctx.globalAlpha = 0.68;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 80) {
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
  ctx.font = '900 44px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(user.username || 'A').slice(0, 1).toUpperCase(), x, y + 2);
  ctx.restore();
}

function drawRankCardPng({ user, avatar, config, stats }) {
  const width = 1000;
  const height = 350;
  const progressWidth = Math.round(660 * stats.progress);
  const displayName = user.globalName || user.displayName || user.username;
  const username = user.username;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const progressGradient = createProgressGradient(ctx, 305, 128, 660, config);

  ctx.fillStyle = config.background_color;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, config.grid_color);

  const ambientGlow = ctx.createRadialGradient(890, 176, 20, 890, 176, 190);
  ambientGlow.addColorStop(0, `${config.progress_start_color}33`);
  ambientGlow.addColorStop(1, `${config.progress_start_color}00`);
  ctx.fillStyle = ambientGlow;
  ctx.beginPath();
  ctx.arc(890, 176, 190, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.44)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 18;
  fillRoundedRect(ctx, 35, 30, 230, 290, 24, config.panel_color);
  ctx.restore();
  strokeRoundedRect(ctx, 35, 30, 230, 290, 24, config.panel_border_color);

  ctx.save();
  ctx.shadowColor = config.progress_start_color;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = progressGradient;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(150, 132, 74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 132, 70, 0, Math.PI * 2);
    ctx.clip();
    drawCoverImage(ctx, avatar, 80, 62, 140, 140);
    ctx.restore();
  } else {
    drawAvatarFallback(ctx, 150, 132, 70, user, config);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = config.rank_color;
  ctx.font = '900 58px Arial';
  ctx.fillText(`#${stats.rank}`, 150, 268);
  ctx.fillStyle = config.rank_label_color;
  ctx.font = '700 11px Arial';
  ctx.fillText('GLOBAL RANK', 150, 294);

  ctx.save();
  ctx.globalAlpha = 0.14;
  fillRoundedRect(ctx, 83, 309, 134, 34, 17, config.status_color);
  ctx.restore();
  strokeRoundedRect(ctx, 83, 309, 134, 34, 17, config.status_color);
  ctx.fillStyle = config.status_color;
  ctx.font = '800 13px Arial';
  ctx.fillText('SUPER ACTIVE', 150, 331);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.display_name_color;
  ctx.font = '900 42px Arial';
  drawTextFit(ctx, displayName, 305, 72, 500);
  ctx.fillStyle = config.username_color;
  ctx.font = '700 14px Arial';
  drawTextFit(ctx, `@${username}`, 307, 100, 420);
  ctx.fillStyle = config.stat_label_color;
  ctx.font = '800 12px Arial';
  ctx.fillText('WEEKLY PROGRESS', 305, 116);

  ctx.textAlign = 'right';
  ctx.fillStyle = config.progress_text_color;
  ctx.font = '900 14px Arial';
  ctx.fillText(`${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`, 965, 117);

  fillRoundedRect(ctx, 305, 128, 660, 30, 15, config.progress_track_color);
  fillRoundedRect(ctx, 305, 128, progressWidth, 30, 15, progressGradient);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.username_color;
  ctx.font = '600 13px Arial';
  ctx.fillText(`${compactNumber(stats.remaining)} more XP for next role`, 305, 181);

  drawStatCard(ctx, {
    x: 305,
    y: 204,
    label: 'DAILY XP',
    value: compactNumber(stats.daily),
    raw: stats.daily.toLocaleString(),
    config,
    progressGradient
  });
  drawStatCard(ctx, {
    x: 543,
    y: 204,
    label: 'LIFETIME',
    value: compactNumber(stats.lifetime),
    raw: stats.lifetime.toLocaleString(),
    config,
    progressGradient
  });

  return canvas.toBuffer('image/png');
}

function drawStatCard(ctx, { x, y, label, value, raw, config, progressGradient }) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 14;
  fillRoundedRect(ctx, x, y, 220, 94, 13, config.stat_card_color);
  ctx.restore();

  strokeRoundedRect(ctx, x, y, 220, 94, 13, config.panel_border_color);
  ctx.fillStyle = progressGradient;
  ctx.fillRect(x + 45, y, 130, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = config.stat_label_color;
  ctx.font = '800 11px Arial';
  ctx.fillText(label, x + 18, y + 30);
  ctx.fillStyle = config.stat_value_color;
  ctx.font = '900 38px Arial';
  ctx.fillText(value, x + 18, y + 68);
  ctx.fillStyle = config.username_color;
  ctx.font = '13px Arial';
  ctx.fillText(raw, x + 18, y + 89);
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
