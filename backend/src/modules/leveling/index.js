import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

// ============================================================================
// REQUIRED CONFIG SCHEMA (DO NOT REMOVE - LOADER NEEDS THIS)
// ============================================================================

const LEVELING_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: true
};

// ============================================================================
// PATHS
// ============================================================================

const FONT_DIR = path.join(process.cwd(), 'src', 'modules', 'leveling', 'assets', 'fonts');

// ============================================================================
// LOGGER
// ============================================================================

const log = (...a) => console.log('[LEVELING]', ...a);
const err = (...a) => console.error('[LEVELING]', ...a);

// ============================================================================
// FONT SAFE REGISTER
// ============================================================================

function registerFonts() {
  try {
    if (!fs.existsSync(FONT_DIR)) {
      err('Font dir missing:', FONT_DIR);
      return;
    }

    const fonts = fs.readdirSync(FONT_DIR);

    const load = (file, family, weight) => {
      const full = path.join(FONT_DIR, file);
      if (!fs.existsSync(full)) return;

      registerFont(full, { family, weight });
      log('Loaded font:', file);
    };

    load('Satoshi-Black.otf', 'Satoshi', '900');
    load('Satoshi-Bold.otf', 'Satoshi', '700');
    load('Inter_24pt-SemiBold.ttf', 'Inter', '600');
    load('Inter_24pt-Regular.ttf', 'Inter', '400');

  } catch (e) {
    err('Font register crash', e);
  }
}

registerFonts();

// ============================================================================
// CARD CONFIG
// ============================================================================

const CARD = {
  w: 1034,
  h: 491
};

// ============================================================================
// HELPERS
// ============================================================================

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function box(ctx, x, y, w, h, r, c) {
  round(ctx, x, y, w, h, r);
  ctx.fillStyle = c;
  ctx.fill();
}

function stroke(ctx, x, y, w, h, r, c, lw = 1) {
  round(ctx, x, y, w, h, r);
  ctx.strokeStyle = c;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function font(ctx, w, s, f = 'Satoshi') {
  ctx.font = `${w} ${s}px "${f}", sans-serif`;
}

function fmt(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ============================================================================
// STATS (TEMP MOCK)
// ============================================================================

function stats(id) {
  const seed = Number(String(id).slice(-6));
  const cur = 2800 + (seed % 500);
  const need = 5000;

  return {
    rank: (seed % 99) + 1,
    current: cur,
    needed: need,
    progress: cur / need,
    daily: 3200,
    life: 90210
  };
}

// ============================================================================
// AVATAR SAFE FETCH
// ============================================================================

async function avatar(user) {
  try {
    const url = user.displayAvatarURL({
      extension: 'png',
      size: 256
    });

    const res = await fetch(url);
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);

  } catch (e) {
    err('Avatar fail:', e);
    return null;
  }
}

// ============================================================================
// BACKGROUND
// ============================================================================

function bg(ctx) {
  const g = ctx.createLinearGradient(0, 0, CARD.w, CARD.h);
  g.addColorStop(0, '#050816');
  g.addColorStop(1, '#0A0416');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD.w, CARD.h);

  box(ctx, 15, 15, CARD.w - 30, CARD.h - 30, 22, 'rgba(10,10,25,0.85)');
  stroke(ctx, 15, 15, CARD.w - 30, CARD.h - 30, 22, 'rgba(168,85,247,0.4)', 1.2);
}

// ============================================================================
// AVATAR DRAW
// ============================================================================

function drawAvatar(ctx, img) {
  const x = 70;
  const y = 70;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 80, y + 80, 78, 0, Math.PI * 2);
  ctx.clip();

  if (img) ctx.drawImage(img, x, y, 160, 160);
  else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, 160, 160);
  }

  ctx.restore();
}

// ============================================================================
// MAIN TEXT
// ============================================================================

function draw(ctx, user, s) {
  ctx.fillStyle = '#fff';
  font(ctx, 900, 52);
  ctx.fillText(user.globalName || user.username, 320, 100);

  ctx.fillStyle = '#aaa';
  font(ctx, 500, 22, 'Inter');
  ctx.fillText(`@${user.username}`, 320, 135);

  ctx.fillStyle = '#fff';
  font(ctx, 900, 70);
  ctx.fillText(`#${s.rank}`, 70, 320);

  // bar
  box(ctx, 320, 180, 600, 30, 20, 'rgba(255,255,255,0.08)');

  box(
    ctx,
    320,
    180,
    Math.max(80, 600 * s.progress),
    30,
    20,
    '#A855F7'
  );

  ctx.fillStyle = '#fff';
  font(ctx, 600, 18, 'Inter');
  ctx.fillText(`${fmt(s.current)} / ${fmt(s.needed)}`, 350, 202);

  ctx.fillStyle = '#aaa';
  ctx.fillText(`${fmt(s.daily)} XP daily`, 320, 260);
  ctx.fillText(`${fmt(s.life)} XP total`, 600, 260);
}

// ============================================================================
// RENDER
// ============================================================================

function render({ user, avatar, stats }) {
  const c = createCanvas(CARD.w, CARD.h);
  const ctx = c.getContext('2d');

  bg(ctx);
  drawAvatar(ctx, avatar);
  draw(ctx, user, stats);

  return c.toBuffer('image/png');
}

// ============================================================================
// BUILD
// ============================================================================

async function build(user) {
  const av = await avatar(user);
  const st = stats(user.id);

  return render({ user, avatar: av, stats: st });
}

// ============================================================================
// MODULE EXPORT
// ============================================================================

export default {
  name: 'leveling',

  configSchema: LEVELING_SCHEMA,

  commands: [
    {
      name: 'rank',
      description: 'Show rank card',

      async execute(interaction) {
        try {
          await interaction.deferReply();

          const png = await build(interaction.user);

          const file = new AttachmentBuilder(png, {
            name: `rank-${interaction.user.id}.png`
          });

          await interaction.editReply({
            files: [file]
          });

        } catch (e) {
          err('CARD ERROR:', e);

          const msg =
            '❌ Card generation failed.\n```' +
            (e?.stack?.slice(0, 1500) || e) +
            '```';

          try {
            if (interaction.deferred) {
              await interaction.editReply({ content: msg });
            } else {
              await interaction.reply({ content: msg, ephemeral: true });
            }
          } catch (sendErr) {
            err('Failed sending error to Discord', sendErr);
          }
        }
      }
    }
  ],

  events: []
};
