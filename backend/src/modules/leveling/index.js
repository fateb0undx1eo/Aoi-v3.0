import { AttachmentBuilder } from 'discord.js';
import {
  createCanvas,
  loadImage,
  registerFont
} from 'canvas';
import path from 'path';
import fs from 'fs';

// ============================================================================
// CONFIG SCHEMA (REQUIRED BY YOUR FRAMEWORK)
// ============================================================================

const LEVELING_SCHEMA = {
  type: 'object',
  properties: {}
};

// ============================================================================
// FONT REGISTRATION
// ============================================================================

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

function tryRegister(name, file, weight = 'normal') {
  try {
    const full = path.join(FONT_DIR, file);

    if (fs.existsSync(full)) {
      registerFont(full, {
        family: name,
        weight
      });

      console.log(`[LEVELING] Loaded font: ${file}`);
    } else {
      console.log(`[LEVELING] Missing font: ${file}`);
    }
  } catch (err) {
    console.error(`[LEVELING] Failed loading font ${file}`, err);
  }
}

tryRegister('Satoshi', 'Satoshi-Black.otf', '900');
tryRegister('Satoshi', 'Satoshi-Bold.otf', '700');

tryRegister('Inter', 'Inter_24pt-SemiBold.ttf', '600');
tryRegister('Inter', 'Inter_24pt-Regular.ttf', '400');

// ============================================================================
// CARD CONFIG
// ============================================================================

const CARD = {
  width: 1034,
  height: 491,
  radius: 24,

  background: '#050816',
  background2: '#090B1E',

  purple: '#A855F7',
  purpleBright: '#C084FC',
  purpleSoft: '#7C3AED',

  white: '#FFFFFF',
  secondary: '#9CA3AF',
  tertiary: '#6B7280',

  green: '#22C55E'
};

// ============================================================================
// HELPERS
// ============================================================================

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, stroke, width = 1) {
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function rgba(hex, alpha) {
  const value = parseInt(hex.replace('#', ''), 16);

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawTextFit(ctx, text, x, y, maxWidth) {
  let value = String(text ?? '');

  while (
    ctx.measureText(value).width > maxWidth &&
    value.length > 0
  ) {
    value = value.slice(0, -1);
  }

  if (value !== text) value += '...';

  ctx.fillText(value, x, y);
}

function setFont(ctx, weight, size, family = 'Satoshi') {
  ctx.font = `${weight} ${size}px "${family}", sans-serif`;
}

function compactNumber(num) {
  if (num >= 1000) {
    const k = num / 1000;

    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }

  return String(num);
}

function getStats(userId) {
  const seed = Number(String(userId).slice(-6));

  const needed = 5000;
  const current = 2900 + (seed % 450);

  return {
    rank: 1 + (seed % 99),

    current,
    needed,

    progress: current / needed,
    remaining: needed - current,

    daily: 3500,
    lifetime: 89121
  };
}

// ============================================================================
// AVATAR
// ============================================================================

async function fetchAvatar(user) {
  try {
    const url = user.displayAvatarURL({
      extension: 'png',
      size: 512
    });

    const response = await fetch(url);

    if (!response.ok) return null;

    return await loadImage(
      Buffer.from(await response.arrayBuffer())
    );
  } catch {
    return null;
  }
}

// ============================================================================
// BACKGROUND
// ============================================================================

function drawBackground(ctx) {
  const bg = ctx.createLinearGradient(
    0,
    0,
    CARD.width,
    CARD.height
  );

  bg.addColorStop(0, '#030510');
  bg.addColorStop(0.5, '#060916');
  bg.addColorStop(1, '#0A0416');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  // Right glow
  const glow1 = ctx.createRadialGradient(
    900,
    120,
    50,
    900,
    120,
    320
  );

  glow1.addColorStop(0, rgba('#A855F7', 0.32));
  glow1.addColorStop(1, rgba('#A855F7', 0));

  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  // Left glow
  const glow2 = ctx.createRadialGradient(
    90,
    240,
    30,
    90,
    240,
    250
  );

  glow2.addColorStop(0, rgba('#7C3AED', 0.20));
  glow2.addColorStop(1, rgba('#7C3AED', 0));

  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  // Main shell
  fillRoundRect(
    ctx,
    15,
    15,
    CARD.width - 30,
    CARD.height - 30,
    22,
    rgba('#050816', 0.80)
  );

  // Border
  strokeRoundRect(
    ctx,
    15,
    15,
    CARD.width - 30,
    CARD.height - 30,
    22,
    rgba('#C084FC', 0.45),
    1.2
  );

  // Noise
  ctx.save();

  ctx.globalAlpha = 0.18;

  for (let i = 0; i < 180; i++) {
    const x = Math.random() * CARD.width;
    const y = Math.random() * CARD.height;

    ctx.fillStyle =
      i % 4 === 0
        ? rgba('#A855F7', 0.5)
        : rgba('#FFFFFF', 0.3);

    ctx.fillRect(x, y, 1.1, 1.1);
  }

  ctx.restore();

  // Separator
  ctx.save();

  ctx.strokeStyle = rgba('#FFFFFF', 0.10);

  ctx.beginPath();
  ctx.moveTo(310, 48);
  ctx.lineTo(310, 440);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// AVATAR DRAW
// ============================================================================

function drawAvatar(ctx, avatar) {
  const x = 52;
  const y = 46;
  const size = 170;

  const centerX = x + size / 2;
  const centerY = y + size / 2;

  // Glow
  ctx.save();

  ctx.shadowColor = '#A855F7';
  ctx.shadowBlur = 40;

  ctx.beginPath();
  ctx.arc(centerX, centerY, 97, 0, Math.PI * 2);

  ctx.strokeStyle = rgba('#A855F7', 0.95);
  ctx.lineWidth = 10;

  ctx.stroke();

  ctx.restore();

  // Outer ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, 92, 0, Math.PI * 2);

  ctx.strokeStyle = '#A855F7';
  ctx.lineWidth = 7;

  ctx.stroke();

  // White ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, 84, 0, Math.PI * 2);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 8;

  ctx.stroke();

  // Avatar clip
  ctx.save();

  ctx.beginPath();
  ctx.arc(centerX, centerY, 76, 0, Math.PI * 2);

  ctx.clip();

  if (avatar) {
    ctx.drawImage(avatar, x + 9, y + 9, 152, 152);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 9, y + 9, 152, 152);
  }

  ctx.restore();

  // Sparkle badge
  ctx.save();

  ctx.shadowColor = '#A855F7';
  ctx.shadowBlur = 20;

  fillRoundRect(
    ctx,
    188,
    176,
    42,
    42,
    21,
    '#0B1022'
  );

  ctx.fillStyle = '#A855F7';

  setFont(ctx, 900, 18);

  ctx.textAlign = 'center';
  ctx.fillText('✦', 209, 204);

  ctx.restore();
}

// ============================================================================
// LEFT SIDE
// ============================================================================

function drawRankSection(ctx, stats) {
  ctx.textAlign = 'center';

  ctx.save();

  ctx.globalAlpha = 0.05;

  setFont(ctx, 900, 120);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(String(stats.rank), 200, 334);

  ctx.restore();

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 82);

  ctx.fillText(`#${stats.rank}`, 145, 320);

  ctx.fillStyle = '#A855F7';

  setFont(ctx, 700, 28, 'Inter');

  ctx.fillText('GLOBAL RANK', 157, 372);

  // Status
  fillRoundRect(
    ctx,
    50,
    394,
    195,
    44,
    24,
    rgba('#22C55E', 0.08)
  );

  strokeRoundRect(
    ctx,
    50,
    394,
    195,
    44,
    24,
    rgba('#22C55E', 0.45),
    1
  );

  ctx.beginPath();
  ctx.arc(78, 416, 6, 0, Math.PI * 2);

  ctx.fillStyle = '#22C55E';
  ctx.fill();

  ctx.fillStyle = '#22C55E';

  setFont(ctx, 700, 24, 'Inter');

  ctx.fillText('SUPER ACTIVE', 147, 423);
}

// ============================================================================
// TOP USER INFO
// ============================================================================

function drawTopUser(ctx, user) {
  const name =
    user.globalName ||
    user.displayName ||
    user.username;

  ctx.textAlign = 'left';

  // Name
  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 56);

  drawTextFit(ctx, name, 344, 85, 360);

  // Username
  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 600, 26, 'Inter');

  drawTextFit(
    ctx,
    `@${user.username}`,
    344,
    121,
    400
  );

  // Badge
  fillRoundRect(
    ctx,
    836,
    50,
    150,
    36,
    11,
    rgba('#12162A', 0.95)
  );

  strokeRoundRect(
    ctx,
    836,
    50,
    150,
    36,
    11,
    rgba('#A855F7', 0.28),
    1
  );

  ctx.fillStyle = '#C4B5FD';

  setFont(ctx, 700, 16, 'Inter');

  ctx.textAlign = 'center';

  ctx.fillText('👥  RANKED USER', 911, 73);
}

// ============================================================================
// PROGRESS
// ============================================================================

function drawProgress(ctx, stats) {
  const x = 344;
  const y = 170;

  const w = 620;
  const h = 40;

  // Label
  ctx.textAlign = 'left';

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 700, 17, 'Inter');

  ctx.fillText('WEEKLY PROGRESS', x, 144);

  // Track
  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    22,
    rgba('#111827', 0.95)
  );

  // Fill gradient
  const gradient = ctx.createLinearGradient(
    x,
    y,
    x + w,
    y
  );

  gradient.addColorStop(0, '#9333EA');
  gradient.addColorStop(0.5, '#A855F7');
  gradient.addColorStop(1, '#C084FC');

  const progressWidth = Math.max(
    120,
    w * stats.progress
  );

  // Glow
  ctx.save();

  ctx.shadowColor = '#A855F7';
  ctx.shadowBlur = 24;

  fillRoundRect(
    ctx,
    x,
    y,
    progressWidth,
    h,
    22,
    gradient
  );

  ctx.restore();

  // Progress text
  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 700, 18, 'Inter');

  ctx.textAlign = 'center';

  ctx.fillText(
    `${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`,
    x + progressWidth - 70,
    y + 26
  );

  // Percent
  ctx.textAlign = 'right';

  ctx.fillStyle = '#6B7280';

  ctx.fillText(
    `${Math.round(stats.progress * 100)}%`,
    x + w - 12,
    y + 26
  );

  // Hint
  ctx.textAlign = 'left';

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 600, 15, 'Inter');

  ctx.fillText(
    `↗  ${compactNumber(stats.remaining)} more for next role`,
    x,
    257
  );
}

// ============================================================================
// STATS
// ============================================================================

function drawStatsCard(ctx, stats) {
  const x = 344;
  const y = 276;

  const w = 620;
  const h = 104;

  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    22,
    rgba('#0B1020', 0.72)
  );

  strokeRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    22,
    rgba('#A855F7', 0.12),
    1
  );

  // Divider
  ctx.save();

  ctx.strokeStyle = rgba('#FFFFFF', 0.10);

  ctx.beginPath();
  ctx.moveTo(654, y + 15);
  ctx.lineTo(654, y + h - 15);
  ctx.stroke();

  ctx.restore();

  // Icon shells
  fillRoundRect(
    ctx,
    366,
    293,
    56,
    56,
    16,
    rgba('#111827', 0.90)
  );

  strokeRoundRect(
    ctx,
    366,
    293,
    56,
    56,
    16,
    rgba('#A855F7', 0.22),
    1
  );

  fillRoundRect(
    ctx,
    681,
    293,
    56,
    56,
    16,
    rgba('#111827', 0.90)
  );

  strokeRoundRect(
    ctx,
    681,
    293,
    56,
    56,
    16,
    rgba('#A855F7', 0.22),
    1
  );

  // Icons
  ctx.fillStyle = '#A855F7';

  setFont(ctx, 900, 28);

  ctx.fillText('✉', 381, 328);
  ctx.fillText('🏆', 696, 328);

  // Stats
  drawStatBlock(
    ctx,
    450,
    321,
    'DAILY XP',
    compactNumber(stats.daily),
    stats.daily.toLocaleString()
  );

  drawStatBlock(
    ctx,
    764,
    321,
    'LIFETIME XP',
    compactNumber(stats.lifetime),
    stats.lifetime.toLocaleString()
  );
}

function drawStatBlock(
  ctx,
  x,
  y,
  label,
  value,
  raw
) {
  ctx.textAlign = 'left';

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 700, 15, 'Inter');

  ctx.fillText(label, x, y - 18);

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 42);

  ctx.fillText(value, x, y + 18);

  ctx.fillStyle = '#6B7280';

  setFont(ctx, 500, 16, 'Inter');

  ctx.fillText(raw, x, y + 44);
}

// ============================================================================
// FOOTER
// ============================================================================

function drawFooter(ctx) {
  ctx.save();

  ctx.strokeStyle = rgba('#FFFFFF', 0.08);

  ctx.beginPath();
  ctx.moveTo(344, 392);
  ctx.lineTo(964, 392);
  ctx.stroke();

  ctx.restore();

  const items = [
    {
      x: 382,
      icon: '🗓',
      label: 'Member since',
      value: 'Jan 12, 2024'
    },
    {
      x: 625,
      icon: '⚡',
      label: 'Activity streak',
      value: '28 days'
    },
    {
      x: 865,
      icon: '◔',
      label: 'Last active',
      value: '5m ago'
    }
  ];

  for (const item of items) {
    ctx.textAlign = 'left';

    ctx.fillStyle = '#9CA3AF';

    setFont(ctx, 500, 14, 'Inter');

    ctx.fillText(
      `${item.icon}  ${item.label}`,
      item.x,
      420
    );

    ctx.fillStyle = '#FFFFFF';

    setFont(ctx, 700, 22, 'Inter');

    ctx.fillText(item.value, item.x, 446);
  }
}

// ============================================================================
// RENDER
// ============================================================================

function renderCard({ user, avatar, stats }) {
  const canvas = createCanvas(
    CARD.width,
    CARD.height
  );

  const ctx = canvas.getContext('2d');

  ctx.antialias = 'subpixel';
  ctx.patternQuality = 'best';
  ctx.quality = 'best';
  ctx.textDrawingMode = 'glyph';

  drawBackground(ctx);

  drawAvatar(ctx, avatar);

  drawRankSection(ctx, stats);

  drawTopUser(ctx, user);

  drawProgress(ctx, stats);

  drawStatsCard(ctx, stats);

  drawFooter(ctx);

  return canvas.toBuffer('image/png');
}

// ============================================================================
// MAIN BUILD
// ============================================================================

async function buildRankAttachment(user) {
  const avatar = await fetchAvatar(user);

  const stats = getStats(user.id);

  const png = renderCard({
    user,
    avatar,
    stats
  });

  return new AttachmentBuilder(png, {
    name: `rank-${user.id}.png`
  });
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  name: 'leveling',

  configSchema: LEVELING_SCHEMA,

  commands: [
    {
      name: 'rank',
      description: 'Show your premium rank card',

      async execute(interaction) {
        await interaction.deferReply();

        const attachment = await buildRankAttachment(
          interaction.user
        );

        await interaction.editReply({
          files: [attachment]
        });
      }
    }
  ],

  events: []
};
