import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs/promises';
import fssync from 'fs';

// ============================================================================
// PATHS
// ============================================================================

const ROOT_DIR = process.cwd();

const FONT_DIR = path.join(
  ROOT_DIR,
  'src/modules/leveling/assets/fonts'
);

const DATA_DIR = path.join(
  ROOT_DIR,
  'src/modules/leveling/data'
);

const DATA_FILE = path.join(DATA_DIR, 'levels.json');

// ============================================================================
// DEBUG
// ============================================================================

const DEBUG = process.env.NODE_ENV !== 'production';

function log(...a) {
  if (DEBUG) console.log('[LEVELING]', ...a);
}

function error(...a) {
  console.error('[LEVELING ERROR]', ...a);
}

// ============================================================================
// GLOBAL SAFETY
// ============================================================================

process.on('unhandledRejection', (e) => {
  console.error('[UNHANDLED]', e);
});

process.on('uncaughtException', (e) => {
  console.error('[CRASH]', e);
});

// ============================================================================
// STORAGE SYSTEM
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
// XP SYSTEM
// ============================================================================

async function getStats(userId) {
  const db = await readDB();

  if (!db[userId]) {
    db[userId] = { xp: 0, level: 1 };
  }

  const user = db[userId];

  const needed = 5000 + user.level * 1200;

  return {
    rank: user.level,
    current: user.xp,
    needed,
    progress: Math.min(user.xp / needed, 1),
    lifetime: user.xp,
    remaining: Math.max(needed - user.xp, 0)
  };
}

// optional XP hook
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
// FONTS
// ============================================================================

function loadFonts() {
  try {
    registerFont(path.join(FONT_DIR, 'Satoshi-Black.otf'), {
      family: 'Satoshi',
      weight: '900'
    });

    registerFont(path.join(FONT_DIR, 'Satoshi-Bold.otf'), {
      family: 'Satoshi',
      weight: '700'
    });

    registerFont(path.join(FONT_DIR, 'Inter_24pt-Regular.ttf'), {
      family: 'Inter',
      weight: '400'
    });

    registerFont(path.join(FONT_DIR, 'Inter_24pt-SemiBold.ttf'), {
      family: 'Inter',
      weight: '600'
    });

    log('Fonts loaded');
  } catch (e) {
    error('Font load failed', e);
  }
}

loadFonts();

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
// CARD SETUP
// ============================================================================

const CARD = {
  width: 1034,
  height: 491
};

// ============================================================================
// HELPERS
// ============================================================================

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, color) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

// ============================================================================
// FALLBACK AVATAR
// ============================================================================

function drawFallback(ctx, user, x, y, size) {
  const letter = (user.username || 'U')[0].toUpperCase();

  const g = ctx.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, '#9333EA');
  g.addColorStop(1, '#C084FC');

  ctx.fillStyle = g;
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
// RENDER CARD
// ============================================================================

function render({ user, avatar, stats }) {
  const canvas = createCanvas(CARD.width, CARD.height);
  const ctx = canvas.getContext('2d');

  try {
    const bg = ctx.createLinearGradient(0, 0, CARD.width, CARD.height);
    bg.addColorStop(0, '#040611');
    bg.addColorStop(1, '#0A0416');

    ctx.fillStyle = bg;
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

    // name
    ctx.fillStyle = '#fff';
    ctx.font = '900 56px Satoshi';
    ctx.fillText(user.globalName || user.username, 344, 90);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '400 24px Inter';
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

    fillRR(ctx, px, py, 620 * stats.progress, 40, 22, prog);

    ctx.fillStyle = '#fff';
    ctx.font = '700 18px Inter';
    ctx.fillText(`${stats.current} / ${stats.needed}`, 365, 206);

    return canvas.toBuffer('image/png');

  } catch (e) {
    error('Render crash', e);
    throw e;
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
// MODULE EXPORT (FIXED FOR YOUR LOADER)
// ============================================================================

export default {
  name: 'leveling',

  // REQUIRED (your loader error)
  configSchema: {},

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

          log(`Rank OK in ${Date.now() - start}ms`);

        } catch (err) {
          error(err);

          const msg =
            `❌ Failed to generate rank card\n\n` +
            `\`\`\`\n${err?.stack || err}\`\`\``;

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: msg });
          } else {
            await interaction.reply({ content: msg, ephemeral: true });
          }
        }
      }
    }
  ],

  events: [] // REQUIRED (your loader)
};
