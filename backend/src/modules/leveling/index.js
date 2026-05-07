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
// STARTUP
// ============================================================================

log('================================================');
log('LEVELING MODULE START');
log('ROOT =', ROOT_DIR);
log('FONT_DIR =', FONT_DIR);
log('================================================');

try {
  if (fs.existsSync(FONT_DIR)) {
    log('Font directory exists');

    const files = fs.readdirSync(FONT_DIR);

    log('Available fonts:', files);
  } else {
    error('Font directory missing');
  }
} catch (err) {
  error('Font directory read failed');
  console.error(err);
}

// ============================================================================
// FONT LOADING
// ============================================================================

function loadFont(family, file, weight) {
  try {
    const full = path.join(FONT_DIR, file);

    if (!fs.existsSync(full)) {
      error('Missing font:', full);
      return;
    }

    registerFont(full, {
      family,
      weight
    });

    log(`Loaded ${file}`);
  } catch (err) {
    error(`Failed loading ${file}`);
    console.error(err);
  }
}

loadFont('Satoshi', 'Satoshi-Black.otf', '900');
loadFont('Satoshi', 'Satoshi-Bold.otf', '700');
loadFont('Inter', 'Inter_24pt-SemiBold.ttf', '600');
loadFont('Inter', 'Inter_24pt-Regular.ttf', '400');

// ============================================================================
// CONFIG
// ============================================================================

const CARD = {
  width: 1034,
  height: 491
};

// ============================================================================
// HELPERS
// ============================================================================

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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();

  ctx.moveTo(x + r, y);

  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);

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

function setFont(
  ctx,
  weight,
  size,
  family = 'Satoshi'
) {
  ctx.font = `${weight} ${size}px "${family}"`;
}

function compactNumber(num) {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }

  return String(num);
}

// ============================================================================
// VECTOR ICONS
// ============================================================================

function drawDiamond(ctx, x, y, size, color) {
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

function drawBars(ctx, x, y, color) {
  ctx.fillStyle = color;

  ctx.fillRect(x, y + 12, 7, 18);
  ctx.fillRect(x + 12, y, 7, 30);
  ctx.fillRect(x + 24, y + 7, 7, 23);
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
        size: 256
      });

    log('Fetching avatar:', url);

    const response = await fetch(url);

    if (!response.ok) {
      error('Avatar fetch failed');
      return null;
    }

    const arrayBuffer =
      await response.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    return await loadImage(buffer);
  } catch (err) {
    error('Avatar load failed');
    console.error(err);

    return null;
  }
}

// ============================================================================
// DRAWING
// ============================================================================

function drawBackground(ctx) {
  const bg =
    ctx.createLinearGradient(
      0,
      0,
      CARD.width,
      CARD.height
    );

  bg.addColorStop(0, '#050816');
  bg.addColorStop(1, '#12071F');

  ctx.fillStyle = bg;

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
}

function drawAvatar(ctx, avatar) {
  const x = 52;
  const y = 46;

  ctx.save();

  ctx.beginPath();

  ctx.arc(137, 131, 76, 0, Math.PI * 2);

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
    ctx.fillStyle = '#1F2937';

    ctx.fillRect(
      x,
      y,
      170,
      170
    );
  }

  ctx.restore();

  ctx.beginPath();

  ctx.arc(137, 131, 84, 0, Math.PI * 2);

  ctx.strokeStyle = '#A855F7';
  ctx.lineWidth = 8;

  ctx.stroke();
}

function drawCard(ctx, user, stats) {
  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 58);

  ctx.fillText(
    user.username,
    340,
    95
  );

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 600, 24, 'Inter');

  ctx.fillText(
    `#${stats.rank}`,
    340,
    132
  );

  fillRoundRect(
    ctx,
    340,
    170,
    600,
    36,
    18,
    '#111827'
  );

  const progress =
    600 * stats.progress;

  const gradient =
    ctx.createLinearGradient(
      340,
      170,
      940,
      170
    );

  gradient.addColorStop(0, '#9333EA');
  gradient.addColorStop(1, '#C084FC');

  fillRoundRect(
    ctx,
    340,
    170,
    progress,
    36,
    18,
    gradient
  );

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 700, 18, 'Inter');

  ctx.fillText(
    `${compactNumber(stats.current)} / ${compactNumber(stats.needed)}`,
    360,
    194
  );

  fillRoundRect(
    ctx,
    340,
    255,
    620,
    110,
    22,
    rgba('#0B1020', 0.75)
  );

  drawDiamond(
    ctx,
    390,
    310,
    10,
    '#A855F7'
  );

  drawBars(
    ctx,
    690,
    290,
    '#A855F7'
  );

  ctx.fillStyle = '#FFFFFF';

  setFont(ctx, 900, 42);

  ctx.fillText(
    compactNumber(stats.daily),
    440,
    325
  );

  ctx.fillText(
    compactNumber(stats.lifetime),
    760,
    325
  );

  ctx.fillStyle = '#9CA3AF';

  setFont(ctx, 600, 15, 'Inter');

  ctx.fillText(
    'DAILY XP',
    440,
    290
  );

  ctx.fillText(
    'LIFETIME XP',
    760,
    290
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

    drawBackground(ctx);

    drawAvatar(ctx, avatar);

    drawCard(ctx, user, stats);

    const buffer =
      canvas.toBuffer('image/png');

    if (!buffer || !buffer.length) {
      throw new Error(
        'PNG buffer empty'
      );
    }

    log(
      `Generated PNG (${buffer.length} bytes)`
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
    const avatar =
      await fetchAvatar(user);

    const stats =
      getStats(user.id);

    const png =
      renderCard({
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
      'buildRankAttachment failed'
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

          log('Card sent');
        } catch (err) {
          error(
            'Command failed'
          );

          console.error(err);

          await interaction.editReply({
            content:
              'Failed to generate rank card.'
          });
        }
      }
    }
  ],

  events: []
};
