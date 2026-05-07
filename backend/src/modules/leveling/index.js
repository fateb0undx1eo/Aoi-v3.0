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
// PATHS
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
// STARTUP DEBUG
// ============================================================================

log('================================================');
log('LEVELING MODULE START');
log('ROOT =', ROOT_DIR);
log('FONT_DIR =', FONT_DIR);
log('================================================');

try {
  if (!fs.existsSync(FONT_DIR)) {
    error('FONT DIRECTORY DOES NOT EXIST');
  } else {
    log('Font directory exists');
    log(
      'Available fonts:',
      fs.readdirSync(FONT_DIR)
    );
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

    if (!fs.existsSync(full)) {
      error(`Missing font ${file}`);
      return;
    }

    registerFont(full, {
      family,
      weight
    });

    LOADED_FONTS.add(
      `${family}-${weight}`
    );

    log(`Loaded ${file}`);
  } catch (err) {
    error(`Failed loading ${file}`);
    console.error(err);
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
// CARD
// ============================================================================

const CARD = {
  width: 1034,
  height: 491
};

// ============================================================================
// HELPERS
// ============================================================================

function roundRect(
  ctx,
  x,
  y,
  w,
  h,
  r
) {
  const radius = Math.min(
    r,
    w / 2,
    h / 2
  );

  ctx.beginPath();

  ctx.moveTo(x + radius, y);

  ctx.arcTo(
    x + w,
    y,
    x + w,
    y + h,
    radius
  );

  ctx.arcTo(
    x + w,
    y + h,
    x,
    y + h,
    radius
  );

  ctx.arcTo(
    x,
    y + h,
    x,
    y,
    radius
  );

  ctx.arcTo(
    x,
    y,
    x + w,
    y,
    radius
  );

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
  roundRect(
    ctx,
    x,
    y,
    w,
    h,
    r
  );

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
  roundRect(
    ctx,
    x,
    y,
    w,
    h,
    r
  );

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

function setFont(
  ctx,
  weight,
  size,
  family = 'Satoshi'
) {
  ctx.font = `${weight} ${size}px "${family}", sans-serif`;
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

function drawBolt(
  ctx,
  x,
  y,
  size,
  color
) {
  ctx.save();

  ctx.beginPath();

  ctx.moveTo(
    x - size * 0.2,
    y - size
  );

  ctx.lineTo(
    x + size * 0.2,
    y - size
  );

  ctx.lineTo(
    x - size * 0.05,
    y
  );

  ctx.lineTo(
    x + size * 0.35,
    y
  );

  ctx.lineTo(
    x - size * 0.3,
    y + size
  );

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

  ctx.fillRect(x, y + 10, 8, 20);
  ctx.fillRect(x + 14, y, 8, 30);
  ctx.fillRect(
    x + 28,
    y + 6,
    8,
    24
  );
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
        size: 256,
        forceStatic: true
      });

    log('Fetching avatar:', url);

    const res = await fetch(url);

    if (!res.ok) {
      error(
        `Avatar request failed ${res.status}`
      );

      return null;
    }

    const arrayBuffer =
      await res.arrayBuffer();

    if (
      !arrayBuffer ||
      arrayBuffer.byteLength === 0
    ) {
      error('Avatar buffer empty');
      return null;
    }

    const buffer = Buffer.from(
      arrayBuffer
    );

    log(
      `Avatar downloaded (${buffer.length} bytes)`
    );

    try {
      const image =
        await loadImage(buffer);

      log(
        'Avatar parsed successfully'
      );

      return image;
    } catch (imgErr) {
      error('loadImage failed');
      console.error(imgErr);

      return null;
    }
  } catch (err) {
    error('fetchAvatar failed');
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

  gradient.addColorStop(0, '#040611');
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
}

// ============================================================================
// AVATAR DRAW
// ============================================================================

function drawAvatar(
  ctx,
  avatar
) {
  try {
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
  } catch (err) {
    error('drawAvatar failed');
    console.error(err);
  }
}

// ============================================================================
// MAIN TEXT
// ============================================================================

function drawMain(
  ctx,
  user,
  stats
) {
  const name =
    user.globalName ||
    user.displayName ||
    user.username;

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 56);

  drawTextFit(
    ctx,
    name,
    344,
    90,
    400
  );

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 600, 24, 'Inter');

  ctx.fillText(
    `@${user.username}`,
    344,
    125
  );

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 82);

  ctx.fillText(
    `#${stats.rank}`,
    60,
    320
  );

  ctx.fillStyle = '#A855F7';

  setFont(ctx, 700, 26, 'Inter');

  ctx.fillText(
    'GLOBAL RANK',
    60,
    360
  );

  const x = 344;
  const y = 180;

  fillRoundRect(
    ctx,
    x,
    y,
    620,
    40,
    22,
    rgba('#111827', 0.95)
  );

  const prog =
    ctx.createLinearGradient(
      x,
      y,
      x + 620,
      y
    );

  prog.addColorStop(0, '#9333EA');
  prog.addColorStop(1, '#C084FC');

  fillRoundRect(
    ctx,
    x,
    y,
    Math.max(
      120,
      620 * stats.progress
    ),
    40,
    22,
    prog
  );

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 700, 18, 'Inter');

  ctx.fillText(
    `${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`,
    365,
    206
  );

  fillRoundRect(
    ctx,
    344,
    280,
    620,
    104,
    22,
    rgba('#0B1020', 0.72)
  );

  drawDiamond(
    ctx,
    394,
    321,
    10,
    '#A855F7'
  );

  drawBolt(
    ctx,
    709,
    321,
    11,
    '#A855F7'
  );

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 42);

  ctx.fillText(
    compactNumber(stats.daily),
    450,
    340
  );

  ctx.fillText(
    compactNumber(stats.lifetime),
    764,
    340
  );

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 600, 16, 'Inter');

  ctx.fillText(
    'DAILY XP',
    450,
    300
  );

  ctx.fillText(
    'LIFETIME XP',
    764,
    300
  );

  drawBars(
    ctx,
    850,
    56,
    '#C4B5FD'
  );
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

    ctx.antialias = 'subpixel';
    ctx.patternQuality = 'best';
    ctx.quality = 'best';
    ctx.textDrawingMode = 'glyph';

    drawBackground(ctx);

    drawAvatar(
      ctx,
      avatar
    );

    drawMain(
      ctx,
      user,
      stats
    );

    let buffer;

    try {
      buffer =
        canvas.toBuffer('image/png');
    } catch (bufferErr) {
      error(
        'canvas.toBuffer failed'
      );

      console.error(bufferErr);

      throw bufferErr;
    }

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

    let png;

    try {
      png = renderCard({
        user,
        avatar,
        stats
      });
    } catch (renderErr) {
      error(
        'Render pipeline crashed'
      );

      console.error(renderErr);

      throw renderErr;
    }

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
