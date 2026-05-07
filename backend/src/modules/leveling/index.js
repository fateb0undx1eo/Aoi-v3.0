import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs/promises';
import fssync from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const ROOT_DIR = process.cwd();

const FONT_DIR = path.join(ROOT_DIR, 'src/modules/leveling/assets/fonts');
const DATA_DIR = path.join(ROOT_DIR, 'src/modules/leveling/data');
const DATA_FILE = path.join(DATA_DIR, 'levels.json');

const DEBUG = process.env.NODE_ENV !== 'production';

// ============================================================================
// GLOBAL ERROR SAFETY
// ============================================================================

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

// ============================================================================
// LOGGING
// ============================================================================

function log(...m) {
  if (DEBUG) console.log('[LEVELING]', ...m);
}

function error(...m) {
  console.error('[LEVELING ERROR]', ...m);
}

// ============================================================================
// STORAGE
// ============================================================================

async function ensureDB() {
  if (!fssync.existsSync(DATA_DIR)) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  if (!fssync.existsSync(DATA_FILE)) {
    await fs.writeFile(DATA_FILE, JSON.stringify({}));
  }
}

async function readDB() {
  await ensureDB();
  return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
}

async function writeDB(db) {
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2));
}

// ============================================================================
// XP SYSTEM (REAL)
// ============================================================================

async function getStats(userId) {
  const db = await readDB();

  if (!db[userId]) {
    db[userId] = { xp: 0, level: 1 };
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
    daily: 3000 + user.level * 50,
    lifetime: user.xp
  };
}

// Optional XP add hook
export async function addXP(userId, amount = 10) {
  const db = await readDB();

  if (!db[userId]) db[userId] = { xp: 0, level: 1 };

  db[userId].xp += amount;

  const needed = 5000 + db[userId].level * 1200;

  if (db[userId].xp >= needed) {
    db[userId].xp -= needed;
    db[userId].level++;
  }

  await writeDB(db);
}

// ============================================================================
// FONT SETUP
// ============================================================================

function registerFonts() {
  try {
    registerFont(path.join(FONT_DIR, 'Satoshi-Black.otf'), {
      family: 'Satoshi',
      weight: '900'
    });

    registerFont(path.join(FONT_DIR, 'Satoshi-Bold.otf'), {
      family: 'Satoshi',
      weight: '700'
    });

    registerFont(path.join(FONT_DIR, 'Inter_24pt-SemiBold.ttf'), {
      family: 'Inter',
      weight: '600'
    });

    registerFont(path.join(FONT_DIR, 'Inter_24pt-Regular.ttf'), {
      family: 'Inter',
      weight: '400'
    });

    log('Fonts loaded');
  } catch (e) {
    error('Font load failed', e);
  }
}

registerFonts();

// ============================================================================
// AVATAR CACHE
// ============================================================================

const avatarCache = new Map();

async function getAvatar(user) {
  try {
    if (avatarCache.has(user.id)) return avatarCache.get(user.id);

    const url = user.displayAvatarURL({
      extension: 'png',
      size: 256,
      forceStatic: true
    });

    const res = await fetch(url);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const img = await loadImage(buffer);

    avatarCache.set(user.id, img);

    return img;
  } catch (e) {
    error('Avatar fetch failed', e);
    return null;
  }
}

// ============================================================================
// CANVAS HELPERS
// ============================================================================

const CARD = { width: 1034, height: 491 };

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

function fillRR(ctx, x, y, w, h, r, col) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = col;
  ctx.fill();
}

function compact(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

// ============================================================================
// FALLBACK AVATAR
// ============================================================================

function drawFallback(ctx, user, x, y, size) {
  const letter = (user.username || 'U')[0].toUpperCase();

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
// RENDER
// ============================================================================

function render({ user, avatar, stats }) {
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');

  try {
    // background
    const g = ctx.createLinearGradient(0, 0, CARD.width, CARD.height);
    g.addColorStop(0, '#040611');
    g.addColorStop(1, '#0A0416');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD.width, CARD.height);

    fillRR(ctx, 15, 15, CARD.width - 30, CARD.height - 30, 22, 'rgba(5,8,22,0.85)');

    // avatar
    const x = 52, y = 46, size = 170;

    if (!avatar) {
      drawFallback(ctx, user, x, y, size);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + 85, y + 85, 76, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, x + 9, y + 9, 152, 152);
      ctx.restore();
    }

    // text
    ctx.fillStyle = '#fff';
    ctx.font = '900 56px Satoshi';
    ctx.fillText(user.globalName || user.username, 344, 90);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 24px Inter';
    ctx.fillText(`@${user.username}`, 344, 125);

    // level
    ctx.fillStyle = '#fff';
    ctx.font = '900 82px Satoshi';
    ctx.fillText(`#${stats.rank}`, 60, 320);

    ctx.fillStyle = '#A855F7';
    ctx.font = '700 26px Inter';
    ctx.fillText('LEVEL', 60, 360);

    // progress
    const px = 344, py = 180;

    fillRR(ctx, px, py, 620, 40, 22, 'rgba(17,24,39,0.9)');

    const prog = ctx.createLinearGradient(px, py, px + 620, py);
    prog.addColorStop(0, '#9333EA');
    prog.addColorStop(1, '#C084FC');

    fillRR(ctx, px, py, Math.max(0, 620 * stats.progress), 40, 22, prog);

    ctx.fillStyle = '#fff';
    ctx.font = '700 18px Inter';
    ctx.fillText(`${compact(stats.current)} / ${compact(stats.needed)}`, 365, 206);

    return canvas.toBuffer('image/png');

  } catch (err) {
    error('Render crash:', err);
    throw err;
  }
}

// ============================================================================
// BUILD ATTACHMENT
// ============================================================================

async function buildRank(user) {
  const avatar = await getAvatar(user);
  const stats = await getStats(user.id);

  const png = render({ user, avatar, stats });

  return new AttachmentBuilder(png, {
    name: `rank-${user.id}.png`
  });
}

// ============================================================================
// EXPORT MODULE
// ============================================================================

export default {
  name: 'leveling',

  commands: [
    {
      name: 'rank',

      async execute(interaction) {
        const start = Date.now();

        try {
          await interaction.deferReply();

          const attachment = await buildRank(interaction.user);

          await interaction.editReply({
            files: [attachment]
          });

          console.log(`[RANK] success in ${Date.now() - start}ms`);

        } catch (err) {
          console.error('[RANK ERROR]', err);

          const msg =
            `❌ Failed to generate rank card\n\n` +
            `\`\`\`\n${err?.stack || err}\n\`\`\``;

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: msg });
          } else {
            await interaction.reply({ content: msg, ephemeral: true });
          }
        }
      }
    }
  ]
};
