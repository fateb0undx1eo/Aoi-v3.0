import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs/promises';
import fssync from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const LEVELING_SCHEMA = { type: 'object', properties: {} };

const ROOT_DIR = process.cwd();

const FONT_DIR = path.join(
  ROOT_DIR,
  'src',
  'modules',
  'leveling',
  'assets',
  'fonts'
);

const DATA_DIR = path.join(
  ROOT_DIR,
  'src',
  'modules',
  'leveling',
  'data'
);

const DATA_FILE = path.join(DATA_DIR, 'levels.json');

const DEBUG = process.env.NODE_ENV !== 'production';

// ============================================================================
// LOGGING
// ============================================================================

function log(...msg) {
  if (DEBUG) console.log('[LEVELING]', ...msg);
}

function error(...msg) {
  console.error('[LEVELING]', ...msg);
}

// ============================================================================
// INIT STORAGE
// ============================================================================

async function ensureStorage() {
  try {
    if (!fssync.existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    if (!fssync.existsSync(DATA_FILE)) {
      await fs.writeFile(DATA_FILE, JSON.stringify({}));
    }
  } catch (err) {
    error('Storage init failed', err);
  }
}

async function readDB() {
  await ensureStorage();
  return JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'));
}

async function writeDB(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============================================================================
// XP SYSTEM
// ============================================================================

async function getUserStats(userId) {
  const db = await readDB();

  if (!db[userId]) {
    db[userId] = {
      xp: 0,
      level: 1
    };
  }

  const user = db[userId];

  const needed = 5000 + user.level * 1200;
  const progress = user.xp / needed;

  return {
    rank: user.level,
    current: user.xp,
    needed,
    progress: Math.min(progress, 1),
    remaining: Math.max(needed - user.xp, 0),
    daily: 3500 + user.level * 50,
    lifetime: user.xp
  };
}

// Optional XP increment hook (use in messageCreate event)
export async function addXP(userId, amount = 10) {
  const db = await readDB();

  if (!db[userId]) {
    db[userId] = { xp: 0, level: 1 };
  }

  db[userId].xp += amount;

  const needed = 5000 + db[userId].level * 1200;

  if (db[userId].xp >= needed) {
    db[userId].xp -= needed;
    db[userId].level += 1;
  }

  await writeDB(db);
}

// ============================================================================
// FONTS
// ============================================================================

const LOADED_FONTS = new Set();

function tryRegister(family, file, weight) {
  try {
    const full = path.join(FONT_DIR, file);

    if (!fssync.existsSync(full)) {
      error('Missing font', file);
      return;
    }

    registerFont(full, { family, weight });
    LOADED_FONTS.add(`${family}-${weight}`);

    log('Loaded font', file);
  } catch (err) {
    error('Font load failed', file, err);
  }
}

tryRegister('Satoshi', 'Satoshi-Black.otf', '900');
tryRegister('Satoshi', 'Satoshi-Bold.otf', '700');
tryRegister('Inter', 'Inter_24pt-SemiBold.ttf', '600');
tryRegister('Inter', 'Inter_24pt-Regular.ttf', '400');

// ============================================================================
// AVATAR CACHE
// ============================================================================

const avatarCache = new Map();

async function fetchAvatar(user) {
  try {
    const key = user.id;

    if (avatarCache.has(key)) {
      return avatarCache.get(key);
    }

    const url = user.displayAvatarURL({
      extension: 'png',
      size: 256,
      forceStatic: true
    });

    const res = await fetch(url);

    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());

    const img = await loadImage(buffer);

    avatarCache.set(key, img);

    return img;
  } catch (err) {
    error('Avatar fetch failed', err);
    return null;
  }
}

// ============================================================================
// CANVAS CONSTANTS
// ============================================================================

const CARD = {
  width: 1034,
  height: 491
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

function rgba(hex, a) {
  const v = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`;
}

function setFont(ctx, w, s, f = 'Satoshi') {
  ctx.font = `${w} ${s}px "${f}", sans-serif`;
}

function compact(n) {
  return n >= 1000
    ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
    : String(n);
}

// ============================================================================
// FALLBACK AVATAR (INITIALS)
// ============================================================================

function drawInitials(ctx, user, x, y, size) {
  const name = user.username || 'U';
  const letter = name.charAt(0).toUpperCase();

  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, '#9333EA');
  grad.addColorStop(1, '#C084FC');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `900 ${size / 2}px Satoshi`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(letter, x + size / 2, y + size / 2);
}

// ============================================================================
// BACKGROUND
// ============================================================================

function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, CARD.width, CARD.height);
  g.addColorStop(0, '#040611');
  g.addColorStop(1, '#0A0416');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  fillRoundRect(ctx, 15, 15, CARD.width - 30, CARD.height - 30, 22, rgba('#050816', 0.82));
}

// ============================================================================
// MAIN RENDER
// ============================================================================

function drawMain(ctx, user, stats) {
  const name = user.globalName || user.username;

  setFont(ctx, 900, 56);
  ctx.fillStyle = '#fff';
  ctx.fillText(name, 344, 90);

  setFont(ctx, 600, 24, 'Inter');
  ctx.fillStyle = '#9CA3AF';
  ctx.fillText(`@${user.username}`, 344, 125);

  // Rank
  setFont(ctx, 900, 82);
  ctx.fillStyle = '#fff';
  ctx.fillText(`#${stats.rank}`, 60, 320);

  setFont(ctx, 700, 26, 'Inter');
  ctx.fillStyle = '#A855F7';
  ctx.fillText('LEVEL', 60, 360);

  // Progress
  const x = 344, y = 180;

  fillRoundRect(ctx, x, y, 620, 40, 22, rgba('#111827', 0.9));

  const prog = ctx.createLinearGradient(x, y, x + 620, y);
  prog.addColorStop(0, '#9333EA');
  prog.addColorStop(1, '#C084FC');

  fillRoundRect(
    ctx,
    x,
    y,
    Math.max(0, 620 * stats.progress),
    40,
    22,
    prog
  );

  setFont(ctx, 700, 18, 'Inter');
  ctx.fillStyle = '#fff';
  ctx.fillText(`${compact(stats.current)} / ${compact(stats.needed)}`, 365, 206);
}

// ============================================================================
// AVATAR DRAW
// ============================================================================

function drawAvatar(ctx, avatar, user) {
  const x = 52;
  const y = 46;
  const size = 170;

  const cx = x + size / 2;
  const cy = y + size / 2;

  if (!avatar) {
    drawInitials(ctx, user, x, y, size);
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 76, 0, Math.PI * 2);
  ctx.clip();

  ctx.drawImage(avatar, x + 9, y + 9, 152, 152);
  ctx.restore();
}

// ============================================================================
// RENDER PIPELINE
// ============================================================================

function renderCard({ user, avatar, stats }) {
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');

  drawBackground(ctx);
  drawAvatar(ctx, avatar, user);
  drawMain(ctx, user, stats);

  return canvas.toBuffer('image/png');
}

// ============================================================================
// COMMAND
// ============================================================================

async function buildRankAttachment(user) {
  const avatar = await fetchAvatar(user);
  const stats = await getUserStats(user.id);

  const png = renderCard({ user, avatar, stats });

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
      description: 'Show your rank card',

      async execute(interaction) {
        try {
          await interaction.deferReply();

          const attachment = await buildRankAttachment(interaction.user);

          await interaction.editReply({
            files: [attachment]
          });
        } catch (err) {
          error(err);

          const msg = 'Failed to generate rank card';

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: msg });
          } else {
            await interaction.reply({ content: msg, ephemeral: true });
          }
        }
      }
    }
  ],

  events: []
};
