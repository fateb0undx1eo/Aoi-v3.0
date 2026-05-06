import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';

const CARD = Object.freeze({
  width: 900,
  height: 400,
  accent: '#A855F7',
  background: '#0B0F14',
  surface: '#11161C',
  progressTrack: '#1A1F26',
  primary: '#FFFFFF',
  secondary: '#9CA3AF',
  tertiary: '#6B7280',
  activeBg: '#112A1F',
  activeText: '#22C55E'
});

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
  background_color: CARD.background,
  panel_color: CARD.surface,
  panel_border_color: CARD.accent,
  display_name_color: CARD.primary,
  username_color: CARD.secondary,
  rank_color: CARD.primary,
  rank_label_color: CARD.secondary,
  progress_track_color: CARD.progressTrack,
  progress_start_color: CARD.accent,
  progress_end_color: CARD.accent,
  progress_text_color: CARD.primary,
  stat_card_color: CARD.surface,
  stat_label_color: CARD.secondary,
  stat_value_color: CARD.primary,
  status_color: CARD.activeText,
  grid_color: CARD.primary
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

function hexToRgba(hex, alpha) {
  const value = Number.parseInt(String(hex).replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const needed = 5000;
  const current = 2600 + (seed % 600);
  const daily = 3000 + (seed % 900);
  const lifetime = 84000 + (seed % 9000);
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

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, width, height, radius, color) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, width, height, radius, color, lineWidth = 1) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
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

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawSubtleGrid(ctx, color) {
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  for (let x = 40; x < CARD.width; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 28);
    ctx.lineTo(x, CARD.height - 28);
    ctx.stroke();
  }

  for (let y = 32; y < CARD.height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(CARD.width - 28, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAvatar(ctx, avatar, user, config) {
  const x = 64;
  const y = 42;
  const size = 140;
  const center = x + size / 2;
  const radius = size / 2;

  ctx.save();
  ctx.shadowColor = hexToRgba(config.progress_start_color, 0.32);
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(center, y + radius, radius + 7, 0, Math.PI * 2);
  ctx.strokeStyle = config.progress_start_color;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, y + radius, radius, 0, Math.PI * 2);
  ctx.clip();

  if (avatar) {
    drawCoverImage(ctx, avatar, x, y, size, size);
  } else {
    ctx.fillStyle = config.panel_color;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = config.display_name_color;
    ctx.font = '700 56px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(user.username || 'A').slice(0, 1).toUpperCase(), center, y + radius + 2);
  }

  ctx.restore();
}

function drawLeftColumn(ctx, avatar, user, config, stats) {
  drawAvatar(ctx, avatar, user, config);

  const rankNumber = String(stats.rank);

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.strokeStyle = config.rank_color;
  ctx.lineWidth = 2;
  ctx.font = '900 102px Arial';
  ctx.strokeText(rankNumber, 180, 291);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = config.rank_color;
  ctx.font = '900 70px Arial';
  ctx.fillText(`#${rankNumber}`, 134, 274);

  ctx.fillStyle = config.rank_label_color;
  ctx.font = '700 14px Arial';
  ctx.fillText('GLOBAL RANK', 134, 302);

  fillRoundRect(ctx, 64, 329, 140, 34, 17, CARD.activeBg);
  ctx.fillStyle = CARD.activeText;
  ctx.beginPath();
  ctx.arc(88, 346, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '700 13px Arial';
  ctx.fillText('SUPER ACTIVE', 143, 351);
}

function drawProgress(ctx, config, stats) {
  const x = 344;
  const y = 170;
  const width = 510;
  const height = 26;
  const fillWidth = Math.round(width * stats.progress);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.stat_label_color;
  ctx.font = '700 14px Arial';
  ctx.fillText('WEEKLY PROGRESS', x, 153);

  fillRoundRect(ctx, x, y, width, height, height / 2, config.progress_track_color);
  fillRoundRect(ctx, x, y, fillWidth, height, height / 2, config.progress_start_color);

  ctx.fillStyle = config.progress_text_color;
  ctx.font = '700 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`,
    x + Math.max(90, fillWidth / 2),
    y + 18
  );

  ctx.fillStyle = CARD.tertiary;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(stats.progress * 100)}%`, x + width - 20, y + 18);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.username_color;
  ctx.font = '600 15px Arial';
  ctx.fillText(`${compactNumber(stats.remaining)} more for next role`, x, 234);
}

function drawStats(ctx, config, stats) {
  const top = 272;
  const leftX = 344;
  const rightX = 615;

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = CARD.tertiary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(584, top - 4);
  ctx.lineTo(584, top + 75);
  ctx.stroke();
  ctx.restore();

  drawStat(ctx, leftX, top, 'DAILY XP', compactNumber(stats.daily), stats.daily.toLocaleString(), config);
  drawStat(ctx, rightX, top, 'LIFETIME XP', compactNumber(stats.lifetime), stats.lifetime.toLocaleString(), config);
}

function drawStat(ctx, x, y, label, value, raw, config) {
  ctx.textAlign = 'left';
  ctx.fillStyle = config.stat_label_color;
  ctx.font = '700 14px Arial';
  ctx.fillText(label, x, y);

  ctx.fillStyle = config.stat_value_color;
  ctx.font = '900 38px Arial';
  ctx.fillText(value, x, y + 38);

  ctx.fillStyle = CARD.tertiary;
  ctx.font = '600 14px Arial';
  ctx.fillText(raw, x, y + 59);
}

function drawRankCardPng({ user, avatar, config, stats }) {
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');
  const displayName = user.globalName || user.displayName || user.username || 'AOI User';

  ctx.fillStyle = config.background_color;
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  drawSubtleGrid(ctx, config.grid_color);

  fillRoundRect(ctx, 15, 15, 870, 370, 16, config.background_color);
  strokeRoundRect(ctx, 15, 15, 870, 370, 16, hexToRgba(config.panel_border_color, 0.55), 1.2);

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = CARD.tertiary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(309, 48);
  ctx.lineTo(309, 354);
  ctx.stroke();
  ctx.restore();

  drawLeftColumn(ctx, avatar, user, config, stats);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.display_name_color;
  ctx.font = '900 40px Arial';
  drawTextFit(ctx, displayName, 344, 88, 410);

  ctx.fillStyle = config.username_color;
  ctx.font = '600 16px Arial';
  drawTextFit(ctx, `@${user.username}`, 344, 117, 420);

  drawProgress(ctx, config, stats);
  drawStats(ctx, config, stats);

  return canvas.toBuffer('image/png');
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
