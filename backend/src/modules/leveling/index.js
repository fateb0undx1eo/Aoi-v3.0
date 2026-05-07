import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';

const CARD = Object.freeze({
  width: 1034,
  height: 491,
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
    ctx.moveTo(x, 24);
    ctx.lineTo(x, CARD.height - 24);
    ctx.stroke();
  }

  for (let y = 32; y < CARD.height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(CARD.width - 24, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAvatar(ctx, avatar, user, config) {
  const x = 59;
  const y = 53;
  const size = 170;
  const center = x + size / 2;
  const radius = size / 2;

  ctx.save();
  ctx.shadowColor = hexToRgba(config.progress_start_color, 0.32);
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(center, y + radius, radius + 14, 0, Math.PI * 2);
  ctx.strokeStyle = config.progress_start_color;
  ctx.lineWidth = 8;
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
    ctx.font = '700 62px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(user.username || 'A').slice(0, 1).toUpperCase(), center, y + radius + 2);
  }

  ctx.restore();
}

function drawLeftColumn(ctx, avatar, user, config, stats) {
  drawAvatar(ctx, avatar, user, config);

  const rankNumber = String(stats.rank);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = config.rank_color;
  ctx.font = '900 82px Arial';
  ctx.fillText(`#${rankNumber}`, 145, 322);

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = config.rank_color;
  ctx.font = '900 95px Arial';
  ctx.fillText(rankNumber, 212, 322);
  ctx.restore();

  ctx.fillStyle = config.rank_label_color;
  ctx.font = '700 30px Arial';
  ctx.fillText('GLOBAL RANK', 165, 372);

  fillRoundRect(ctx, 45, 395, 220, 42, 21, CARD.activeBg);
  strokeRoundRect(ctx, 45, 395, 220, 42, 21, hexToRgba(config.status_color, 0.5), 1.2);
  ctx.fillStyle = CARD.activeText;
  ctx.beginPath();
  ctx.arc(71, 416, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '700 29px Arial';
  ctx.fillText('SUPER ACTIVE', 162, 422);
}

function drawProgress(ctx, config, stats) {
  const x = 343;
  const y = 171;
  const width = 621;
  const height = 40;
  const fillWidth = Math.round(width * stats.progress);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.stat_label_color;
  ctx.font = '700 31px Arial';
  ctx.fillText('WEEKLY PROGRESS', x, 145);

  fillRoundRect(ctx, x, y, width, height, 20, config.progress_track_color);
  fillRoundRect(ctx, x, y, fillWidth, height, 20, config.progress_start_color);

  ctx.fillStyle = config.progress_text_color;
  ctx.font = '700 34px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`,
    x + Math.max(130, fillWidth / 2),
    y + 30
  );

  ctx.fillStyle = CARD.tertiary;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(stats.progress * 100)}%`, x + width - 10, y + 30);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.username_color;
  ctx.font = '600 31px Arial';
  ctx.fillText(`${compactNumber(stats.remaining)} more for next role`, x + 30, 257);
}

function drawStats(ctx, config, stats) {
  const shellX = 343;
  const shellY = 276;
  const shellW = 621;
  const shellH = 103;
  const leftX = 445;
  const rightX = 714;
  const top = 321;

  strokeRoundRect(ctx, shellX, shellY, shellW, shellH, 18, hexToRgba(config.panel_border_color, 0.2), 1);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = CARD.tertiary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(654, shellY + 15);
  ctx.lineTo(654, shellY + shellH - 15);
  ctx.stroke();
  ctx.restore();

  fillRoundRect(ctx, 367, 293, 52, 52, 12, hexToRgba(config.panel_color, 0.95));
  strokeRoundRect(ctx, 367, 293, 52, 52, 12, hexToRgba(config.panel_border_color, 0.35), 1);
  fillRoundRect(ctx, 682, 293, 52, 52, 12, hexToRgba(config.panel_color, 0.95));
  strokeRoundRect(ctx, 682, 293, 52, 52, 12, hexToRgba(config.panel_border_color, 0.35), 1);

  drawStat(ctx, leftX, top, 'DAILY XP', compactNumber(stats.daily), stats.daily.toLocaleString(), config);
  drawStat(ctx, rightX, top, 'LIFETIME XP', compactNumber(stats.lifetime), stats.lifetime.toLocaleString(), config);
}

function drawStat(ctx, x, y, label, value, raw, config) {
  ctx.textAlign = 'left';
  ctx.fillStyle = config.stat_label_color;
  ctx.font = '700 31px Arial';
  ctx.fillText(label, x, y - 20);

  ctx.fillStyle = config.stat_value_color;
  ctx.font = '900 51px Arial';
  ctx.fillText(value, x, y + 18);

  ctx.fillStyle = CARD.tertiary;
  ctx.font = '600 31px Arial';
  ctx.fillText(raw, x, y + 48);
}

function drawFooterMeta(ctx, config) {
  const y = 430;
  ctx.save();
  ctx.strokeStyle = hexToRgba(config.panel_border_color, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(343, 391);
  ctx.lineTo(964, 391);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = config.rank_label_color;
  ctx.font = '500 23px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Member since', 383, y);
  ctx.fillText('Activity streak', 627, y);
  ctx.fillText('Last active', 857, y);

  ctx.fillStyle = config.stat_value_color;
  ctx.font = '600 32px Arial';
  ctx.fillText('Jan 12, 2024', 383, y + 32);
  ctx.fillText('28 days', 627, y + 32);
  ctx.fillText('5m ago', 857, y + 32);
}

function drawRankCardPng({ user, avatar, config, stats }) {
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');
  const displayName = user.globalName || user.displayName || user.username || 'AOI User';

  ctx.fillStyle = config.background_color;
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  drawSubtleGrid(ctx, config.grid_color);

  fillRoundRect(ctx, 15, 15, CARD.width - 30, CARD.height - 30, 18, config.background_color);
  strokeRoundRect(ctx, 15, 15, CARD.width - 30, CARD.height - 30, 18, hexToRgba(config.panel_border_color, 0.55), 1.2);

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = CARD.tertiary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(308, 48);
  ctx.lineTo(308, CARD.height - 48);
  ctx.stroke();
  ctx.restore();

  drawLeftColumn(ctx, avatar, user, config, stats);

  ctx.textAlign = 'left';
  ctx.fillStyle = config.display_name_color;
  ctx.font = '900 57px Arial';
  drawTextFit(ctx, displayName, 343, 86, 470);

  ctx.fillStyle = config.username_color;
  ctx.font = '600 34px Arial';
  drawTextFit(ctx, `@${user.username}`, 343, 125, 490);

  fillRoundRect(ctx, 857, 48, 130, 34, 10, hexToRgba(config.panel_color, 0.95));
  strokeRoundRect(ctx, 857, 48, 130, 34, 10, hexToRgba(config.panel_border_color, 0.3), 1);
  ctx.fillStyle = config.rank_label_color;
  ctx.font = '700 17px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('RANKED USER', 922, 71);

  drawProgress(ctx, config, stats);
  drawStats(ctx, config, stats);
  drawFooterMeta(ctx, config);

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
