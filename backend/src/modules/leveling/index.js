import { AttachmentBuilder } from 'discord.js';
import {
  createCanvas,
  loadImage,
  registerFont
} from 'canvas';

import path from 'path';
import fs from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const LEVELING_SCHEMA = {
  type: 'object',
  properties: {}
};

// ============================================================================
// ROOT PATH FIX
// ============================================================================

const ROOT_DIR = process.cwd();

const FONT_DIR = path.join(
  ROOT_DIR,
  'src',
  'modules',
  'leveling',
  'assets',
  'fonts'
);

// ============================================================================
// LOGGER
// ============================================================================

function log(...msg) {
  console.log('[LEVELING]', ...msg);
}

function error(...msg) {
  console.error('[LEVELING]', ...msg);
}

// ============================================================================
// DEBUG
// ============================================================================

log('================================================');
log('LEVELING MODULE START');
log('process.cwd() =', ROOT_DIR);
log('FONT_DIR =', FONT_DIR);
log('================================================');

try {
  if (!fs.existsSync(FONT_DIR)) {
    error('FONT DIRECTORY DOES NOT EXIST');
  } else {
    const files = fs.readdirSync(FONT_DIR);

    log('Font directory exists');
    log('Available fonts:', files);
  }
} catch (err) {
  error('Failed reading font directory');
  console.error(err);
}

// ============================================================================
// FONT REGISTRATION
// ============================================================================

const LOADED_FONTS = new Set();

function tryRegister(
  family,
  file,
  weight = 'normal'
) {
  try {
    const full = path.join(FONT_DIR, file);

    log(`Trying font: ${file}`);

    if (!fs.existsSync(full)) {
      error(`Missing font -> ${full}`);
      return false;
    }

    registerFont(full, {
      family,
      weight
    });

    LOADED_FONTS.add(`${family}-${weight}`);

    log(
      `Loaded font "${file}" as ${family} (${weight})`
    );

    return true;
  } catch (err) {
    error(`Failed loading font "${file}"`);
    console.error(err);

    return false;
  }
}

tryRegister(
  'Satoshi',
  'Satoshi-Black.otf',
  '900'
);

tryRegister(
  'Satoshi',
  'Satoshi-Bold.otf',
  '700'
);

tryRegister(
  'Inter',
  'Inter_24pt-SemiBold.ttf',
  '600'
);

tryRegister(
  'Inter',
  'Inter_24pt-Regular.ttf',
  '400'
);

// ============================================================================
// CARD CONFIG
// ============================================================================

const CARD = {
  width: 1034,
  height: 491,

  purple: '#A855F7',
  purple2: '#C084FC',

  white: '#FFFFFF',
  secondary: '#9CA3AF',
  muted: '#6B7280',

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

function fillRoundRect(
  ctx,
  x,
  y,
  w,
  h,
  r,
  fill
) {
  roundRect(ctx, x, y, w, h, r);

  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(
  ctx,
  x,
  y,
  w,
  h,
  r,
  stroke,
  width = 1
) {
  roundRect(ctx, x, y, w, h, r);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;

  ctx.stroke();
}

function rgba(hex, alpha) {
  const value = parseInt(
    hex.replace('#', ''),
    16
  );

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function compactNumber(num) {
  if (num >= 1000) {
    const k = num / 1000;

    return `${
      k % 1 === 0
        ? k.toFixed(0)
        : k.toFixed(1)
    }K`;
  }

  return String(num);
}

function drawTextFit(
  ctx,
  text,
  x,
  y,
  maxWidth
) {
  let value = String(text ?? '');

  while (
    ctx.measureText(value).width >
      maxWidth &&
    value.length > 0
  ) {
    value = value.slice(0, -1);
  }

  if (value !== text) {
    value += '...';
  }

  ctx.fillText(value, x, y);
}

function setFont(
  ctx,
  weight,
  size,
  family = 'Satoshi'
) {
  ctx.font = `${weight} ${size}px "${family}", sans-serif`;
}

// ============================================================================
// SVG STYLE ICONS
// ============================================================================

function drawDiamond(
  ctx,
  x,
  y,
  size,
  color
) {
  ctx.save();

  ctx.beginPath();

  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);

  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}

function drawBars(
  ctx,
  x,
  y,
  color
) {
  ctx.fillStyle = color;

  ctx.fillRect(x, y + 12, 8, 18);
  ctx.fillRect(x + 14, y + 4, 8, 26);
  ctx.fillRect(x + 28, y, 8, 30);
}

function drawPulse(
  ctx,
  x,
  y,
  color
) {
  ctx.save();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  ctx.beginPath();

  ctx.moveTo(x, y + 8);
  ctx.lineTo(x + 8, y + 8);
  ctx.lineTo(x + 12, y);
  ctx.lineTo(x + 18, y + 16);
  ctx.lineTo(x + 24, y + 4);
  ctx.lineTo(x + 30, y + 8);
  ctx.lineTo(x + 40, y + 8);

  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// DATA
// ============================================================================

function getStats(userId) {
  const seed = Number(
    String(userId).slice(-6)
  );

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
    const url =
      user.displayAvatarURL({
        extension: 'png',
        size: 512
      });

    log('Fetching avatar:', url);

    const response = await fetch(url);

    if (!response.ok) {
      error(
        `Avatar request failed: ${response.status}`
      );

      return null;
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    const image =
      await loadImage(buffer);

    log('Avatar loaded');

    return image;
  } catch (err) {
    error('Avatar loading failed');
    console.error(err);

    return null;
  }
}

// ============================================================================
// BACKGROUND
// ============================================================================

function drawBackground(ctx) {
  const gradient =
    ctx.createLinearGradient(
      0,
      0,
      CARD.width,
      CARD.height
    );

  gradient.addColorStop(0, '#050816');
  gradient.addColorStop(1, '#0A0416');

  ctx.fillStyle = gradient;

  ctx.fillRect(
    0,
    0,
    CARD.width,
    CARD.height
  );

  fillRoundRect(
    ctx,
    15,
    15,
    CARD.width - 30,
    CARD.height - 30,
    22,
    rgba('#050816', 0.82)
  );

  strokeRoundRect(
    ctx,
    15,
    15,
    CARD.width - 30,
    CARD.height - 30,
    22,
    rgba('#C084FC', 0.4),
    1.2
  );

  const glow =
    ctx.createRadialGradient(
      850,
      120,
      40,
      850,
      120,
      320
    );

  glow.addColorStop(
    0,
    rgba('#A855F7', 0.28)
  );

  glow.addColorStop(
    1,
    rgba('#A855F7', 0)
  );

  ctx.fillStyle = glow;

  ctx.fillRect(
    0,
    0,
    CARD.width,
    CARD.height
  );

  ctx.save();

  ctx.strokeStyle = rgba(
    '#FFFFFF',
    0.08
  );

  ctx.beginPath();

  ctx.moveTo(310, 48);
  ctx.lineTo(310, 440);

  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// AVATAR
// ============================================================================

function drawAvatar(ctx, avatar) {
  const x = 52;
  const y = 46;
  const size = 170;

  const cx = x + size / 2;
  const cy = y + size / 2;

  ctx.save();

  ctx.shadowColor = '#A855F7';
  ctx.shadowBlur = 40;

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    96,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle = rgba(
    '#A855F7',
    0.9
  );

  ctx.lineWidth = 10;

  ctx.stroke();

  ctx.restore();

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    84,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 8;

  ctx.stroke();

  ctx.save();

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    76,
    0,
    Math.PI * 2
  );

  ctx.clip();

  if (avatar) {
    ctx.drawImage(
      avatar,
      x + 9,
      y + 9,
      152,
      152
    );
  } else {
    ctx.fillStyle = '#FFFFFF';

    ctx.fillRect(
      x + 9,
      y + 9,
      152,
      152
    );
  }

  ctx.restore();

  fillRoundRect(
    ctx,
    188,
    176,
    42,
    42,
    21,
    '#0B1022'
  );

  drawDiamond(
    ctx,
    209,
    197,
    8,
    '#A855F7'
  );
}

// ============================================================================
// RANK
// ============================================================================

function drawRankSection(
  ctx,
  stats
) {
  ctx.textAlign = 'center';

  ctx.save();

  ctx.globalAlpha = 0.05;

  setFont(ctx, 900, 120);

  ctx.fillStyle = '#FFFFFF';

  ctx.fillText(
    String(stats.rank),
    200,
    334
  );

  ctx.restore();

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 82);

  ctx.fillText(
    `#${stats.rank}`,
    145,
    320
  );

  ctx.fillStyle = '#A855F7';

  setFont(ctx, 700, 28, 'Inter');

  ctx.fillText(
    'GLOBAL RANK',
    157,
    372
  );

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
    rgba('#22C55E', 0.35),
    1
  );

  drawPulse(
    ctx,
    64,
    404,
    '#22C55E'
  );

  ctx.fillStyle = '#22C55E';

  setFont(ctx, 700, 22, 'Inter');

  ctx.fillText(
    'ACTIVE',
    145,
    423
  );
}

// ============================================================================
// USER
// ============================================================================

function drawTopUser(
  ctx,
  user
) {
  const name =
    user.globalName ||
    user.displayName ||
    user.username;

  ctx.textAlign = 'left';

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 56);

  drawTextFit(
    ctx,
    name,
    344,
    85,
    360
  );

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 600, 26, 'Inter');

  drawTextFit(
    ctx,
    `@${user.username}`,
    344,
    121,
    400
  );

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

  drawBars(
    ctx,
    852,
    56,
    '#C4B5FD'
  );

  ctx.fillStyle = '#C4B5FD';

  setFont(ctx, 700, 14, 'Inter');

  ctx.fillText(
    'RANKED USER',
    900,
    72
  );
}

// ============================================================================
// PROGRESS
// ============================================================================

function drawProgress(
  ctx,
  stats
) {
  const x = 344;
  const y = 170;

  const w = 620;
  const h = 40;

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 700, 17, 'Inter');

  ctx.fillText(
    'WEEKLY PROGRESS',
    x,
    144
  );

  fillRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    22,
    rgba('#111827', 0.95)
  );

  const gradient =
    ctx.createLinearGradient(
      x,
      y,
      x + w,
      y
    );

  gradient.addColorStop(0, '#9333EA');
  gradient.addColorStop(1, '#C084FC');

  const progressWidth = Math.max(
    120,
    w * stats.progress
  );

  fillRoundRect(
    ctx,
    x,
    y,
    progressWidth,
    h,
    22,
    gradient
  );

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 700, 18, 'Inter');

  ctx.textAlign = 'center';

  ctx.fillText(
    `${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`,
    x + progressWidth - 70,
    y + 26
  );
}

// ============================================================================
// STATS
// ============================================================================

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

  setFont(ctx, 400, 16, 'Inter');

  ctx.fillText(raw, x, y + 44);
}

function drawStatsCard(
  ctx,
  stats
) {
  fillRoundRect(
    ctx,
    344,
    276,
    620,
    104,
    22,
    rgba('#0B1020', 0.72)
  );

  strokeRoundRect(
    ctx,
    344,
    276,
    620,
    104,
    22,
    rgba('#A855F7', 0.12),
    1
  );

  fillRoundRect(
    ctx,
    366,
    293,
    56,
    56,
    16,
    rgba('#111827', 0.90)
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

  drawDiamond(
    ctx,
    394,
    321,
    10,
    '#A855F7'
  );

  drawBars(
    ctx,
    694,
    304,
    '#A855F7'
  );

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

// ============================================================================
// FOOTER
// ============================================================================

function drawFooter(ctx) {
  ctx.save();

  ctx.strokeStyle = rgba(
    '#FFFFFF',
    0.08
  );

  ctx.beginPath();

  ctx.moveTo(344, 392);
  ctx.lineTo(964, 392);

  ctx.stroke();

  ctx.restore();

  const items = [
    {
      x: 382,
      label: 'Member since',
      value: 'Jan 12 2024'
    },
    {
      x: 625,
      label: 'Activity streak',
      value: '28 days'
    },
    {
      x: 865,
      label: 'Last active',
      value: '5m ago'
    }
  ];

  for (const item of items) {
    ctx.fillStyle = '#9CA3AF';

    setFont(ctx, 400, 14, 'Inter');

    ctx.fillText(
      item.label,
      item.x,
      420
    );

    ctx.fillStyle = '#FFFFFF';

    setFont(ctx, 700, 22, 'Inter');

    ctx.fillText(
      item.value,
      item.x,
      446
    );
  }
}

// ============================================================================
// RENDER
// ============================================================================

function renderCard({
  user,
  avatar,
  stats
}) {
  try {
    log('Rendering card');

    const canvas = createCanvas(
      CARD.width,
      CARD.height
    );

    const ctx =
      canvas.getContext('2d');

    drawBackground(ctx);
    drawAvatar(ctx, avatar);
    drawRankSection(ctx, stats);
    drawTopUser(ctx, user);
    drawProgress(ctx, stats);
    drawStatsCard(ctx, stats);
    drawFooter(ctx);

    const buffer =
      canvas.toBuffer('image/png');

    log(
      `PNG created (${buffer.length} bytes)`
    );

    return buffer;
  } catch (err) {
    error('renderCard failed');
    console.error(err);

    throw err;
  }
}

// ============================================================================
// BUILD
// ============================================================================

async function buildRankAttachment(
  user
) {
  try {
    log(
      `Building rank card for ${user.username}`
    );

    const avatar =
      await fetchAvatar(user);

    const stats =
      getStats(user.id);

    const png = renderCard({
      user,
      avatar,
      stats
    });

    return new AttachmentBuilder(
      png,
      {
        name: `rank-${user.id}.png`
      }
    );
  } catch (err) {
    error(
      'Failed building attachment'
    );

    console.error(err);

    throw err;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  name: 'leveling',

  configSchema:
    LEVELING_SCHEMA,

  commands: [
    {
      name: 'rank',

      description:
        'Show your premium rank card',

      async execute(
        interaction
      ) {
        try {
          log(
            `/rank used by ${interaction.user.username}`
          );

          await interaction.deferReply();

          const attachment =
            await buildRankAttachment(
              interaction.user
            );

          await interaction.editReply({
            files: [attachment]
          });

          log(
            'Rank card sent successfully'
          );
        } catch (err) {
          error(
            'Command execution failed'
          );

          console.error(err);

          const content =
            'Failed to generate rank card. Check logs.';

          if (
            interaction.deferred ||
            interaction.replied
          ) {
            await interaction.editReply({
              content
            });
          } else {
            await interaction.reply({
              content,
              ephemeral: true
            });
          }
        }
      }
    }
  ],

  events: []
};
