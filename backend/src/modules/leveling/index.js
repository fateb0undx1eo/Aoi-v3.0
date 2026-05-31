import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger.js';

// ============================================================================
// REQUIRED FOR LOADER
// ============================================================================

const LEVELING_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: true,
};

// ============================================================================
// PATHS
// ============================================================================

const FONT_DIR = path.join(
  process.cwd(),
  'src', 'modules', 'leveling', 'assets', 'fonts'
);

// ============================================================================
// LOGGING
// ============================================================================

const log = (...a) => logger.info({ module: 'leveling' }, a.join(' '));
const err = (...a) => logger.error({ module: 'leveling' }, a.join(' '));

// ============================================================================
// FONTS
// ============================================================================

function loadFonts() {
  try {
    if (!fs.existsSync(FONT_DIR)) return;
    const load = (file, family, weight) => {
      const full = path.join(FONT_DIR, file);
      if (!fs.existsSync(full)) return;
      registerFont(full, { family, weight });
      log('Font loaded:', file);
    };
    load('Satoshi-Black.otf',        'Satoshi', '900');
    load('Satoshi-Bold.otf',         'Satoshi', '700');
    load('Inter_24pt-SemiBold.ttf',  'Inter',   '600');
    load('Inter_24pt-Regular.ttf',   'Inter',   '400');
  } catch (e) {
    err('Font load error:', e);
  }
}

loadFonts();

// ============================================================================
// THEME — single source of truth, edit anything here to retheme
// ============================================================================

const T = {
  // Canvas
  canvasW: 1400,
  canvasH: 560,

  // Palette
  bg:           '#080a0f',
  accent:       '#00d4c8',
  accentDim:    'rgba(0,212,200,0.18)',
  accentGlow:   'rgba(0,212,200,0.08)',
  accentStrong: 'rgba(0,212,200,0.55)',

  gold:         '#f0c060',
  goldDim:      'rgba(240,192,96,0.15)',

  green:        '#1eed8a',
  greenDim:     'rgba(30,237,138,0.12)',
  greenBorder:  'rgba(30,237,138,0.45)',

  border:       'rgba(255,255,255,0.07)',

  textHero:      '#ffffff',
  textPrimary:   '#e8eaf0',
  textSecondary: '#8892a4',
  textMuted:     '#48515f',

  avatarStripW: 360,
  pad:          40,
};

// ============================================================================
// HELPERS
// ============================================================================

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function box(ctx, x, y, w, h, r, c) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = c;
  ctx.fill();
}

function strk(ctx, x, y, w, h, r, c, lw = 1) {
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = c;
  ctx.lineWidth   = lw;
  ctx.stroke();
}

function setFont(ctx, weight, size, family = 'Satoshi') {
  ctx.font = `${weight} ${size}px "${family}", sans-serif`;
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtComma(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function addNoise(ctx, x, y, w, h, opacity = 0.025) {
  const d = ctx.getImageData(x, y, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = (Math.random() - 0.5) * 255 * opacity;
    d.data[i]     += v;
    d.data[i + 1] += v;
    d.data[i + 2] += v;
  }
  ctx.putImageData(d, x, y);
}

// ============================================================================
// STATS
// ============================================================================

function getStats(id) {
  const seed    = Number(String(id).slice(-6));
  const current = 2900 + (seed % 500);
  const needed  = 5000;
  return {
    rank:        43,
    current,
    needed,
    progress:    current / needed,
    daily:       3521,
    life:        89121,
    memberSince: 'Jan 12, 2024',
    streak:      28,
    lastActive:  '5m ago',
  };
}

// ============================================================================
// AVATAR
// ============================================================================

async function getAvatar(user) {
  try {
    const url = user.displayAvatarURL({ extension: 'png', size: 512 });
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    err('Avatar error:', e);
    return null;
  }
}

// ============================================================================
// DRAW: BACKGROUND
// ============================================================================

function drawBackground(ctx) {
  const W = T.canvasW;
  const H = T.canvasH;

  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, W, H);

  // Ambient teal glow — top right
  const g1 = ctx.createRadialGradient(W * 0.78, -40, 60, W * 0.78, -40, 520);
  g1.addColorStop(0,   'rgba(0,212,200,0.09)');
  g1.addColorStop(0.5, 'rgba(0,212,200,0.03)');
  g1.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  // Warm gold glow — bottom left
  const g2 = ctx.createRadialGradient(120, H + 60, 20, 120, H + 60, 380);
  g2.addColorStop(0, 'rgba(240,192,96,0.07)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid — content area only
  ctx.strokeStyle = 'rgba(255,255,255,0.028)';
  ctx.lineWidth   = 1;
  const gs = 52;
  for (let gx = T.avatarStripW + gs; gx < W; gx += gs) {
    for (let gy = gs; gy < H; gy += gs) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  addNoise(ctx, 0, 0, W, H, 0.018);
}

// ============================================================================
// DRAW: AVATAR FULL-BLEED PANEL
// ============================================================================

function drawAvatarPanel(ctx, img) {
  const H  = T.canvasH;
  const sw = T.avatarStripW;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, sw, H);
  ctx.clip();

  if (img) {
    const scale = H / img.height;
    const iw    = img.width  * scale;
    const ih    = img.height * scale;
    const ix    = (sw - iw) / 2;
    ctx.drawImage(img, ix, 0, iw, ih);
  } else {
    const pg = ctx.createLinearGradient(0, 0, sw, H);
    pg.addColorStop(0, '#0d1018');
    pg.addColorStop(1, '#141820');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, sw, H);
  }

  // Right-edge fade into bg
  const fade = ctx.createLinearGradient(sw - 140, 0, sw, 0);
  fade.addColorStop(0,   'rgba(8,10,15,0)');
  fade.addColorStop(0.55,'rgba(8,10,15,0.65)');
  fade.addColorStop(1,   'rgba(8,10,15,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, sw, H);

  // Top vignette
  const tv = ctx.createLinearGradient(0, 0, 0, 90);
  tv.addColorStop(0, 'rgba(8,10,15,0.75)');
  tv.addColorStop(1, 'rgba(8,10,15,0)');
  ctx.fillStyle = tv;
  ctx.fillRect(0, 0, sw, H);

  // Bottom vignette
  const bv = ctx.createLinearGradient(0, H - 110, 0, H);
  bv.addColorStop(0, 'rgba(8,10,15,0)');
  bv.addColorStop(1, 'rgba(8,10,15,0.85)');
  ctx.fillStyle = bv;
  ctx.fillRect(0, 0, sw, H);

  // Accent border line
  const linG = ctx.createLinearGradient(0, 0, 0, H);
  linG.addColorStop(0,    'rgba(0,212,200,0)');
  linG.addColorStop(0.3,  T.accent);
  linG.addColorStop(0.7,  T.accent);
  linG.addColorStop(1,    'rgba(0,212,200,0)');
  ctx.strokeStyle = linG;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(sw - 1, 0);
  ctx.lineTo(sw - 1, H);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// DRAW: RANK GHOST WATERMARK
// ============================================================================

function drawRankWatermark(ctx, rank) {
  const H  = T.canvasH;
  const rx = T.avatarStripW + 24;
  ctx.save();
  setFont(ctx, 900, 320, 'Satoshi');
  ctx.fillStyle = 'rgba(0,212,200,0.035)';
  ctx.fillText(`#${rank}`, rx, H * 0.88);
  ctx.restore();
}

// ============================================================================
// DRAW: CONTENT
// ============================================================================

function drawContent(ctx, user, stats) {
  const W  = T.canvasW;
  const H  = T.canvasH;
  const lx = T.avatarStripW + 52;

  // ── NAME ────────────────────────────────────────────────────────────────
  const nameY = 108;
  setFont(ctx, 900, 72, 'Satoshi');
  ctx.fillStyle = T.textHero;
  ctx.fillText(user.globalName || user.username, lx, nameY);

  setFont(ctx, 400, 23, 'Inter');
  ctx.fillStyle = T.textMuted;
  ctx.fillText(`@${user.username}`, lx + 2, nameY + 34);

  // ── RANK BADGE inline with name ─────────────────────────────────────────
  setFont(ctx, 900, 72, 'Satoshi');
  const nameW  = ctx.measureText(user.globalName || user.username).width;
  const badgeX = lx + nameW + 20;
  const badgeY = nameY - 50;

  setFont(ctx, 700, 13, 'Inter');
  const rankLabel = `RANK  #${stats.rank}`;
  const bw = ctx.measureText(rankLabel).width + 26;
  const bh = 30;
  box(ctx, badgeX, badgeY, bw, bh, 7, T.goldDim);
  strk(ctx, badgeX, badgeY, bw, bh, 7, 'rgba(240,192,96,0.38)', 1);
  ctx.fillStyle = T.gold;
  ctx.fillText(rankLabel, badgeX + 13, badgeY + bh / 2 + 5);

  // ── STATUS PILL ─────────────────────────────────────────────────────────
  const spY = nameY + 56;
  setFont(ctx, 600, 13, 'Inter');
  const spLabel = '● SUPER ACTIVE';
  const spW     = ctx.measureText(spLabel).width + 24;
  const spH     = 26;
  box(ctx, lx, spY, spW, spH, 13, T.greenDim);
  strk(ctx, lx, spY, spW, spH, 13, T.greenBorder, 1);
  ctx.fillStyle = T.green;
  ctx.fillText(spLabel, lx + 12, spY + 18);

  // ── PROGRESS ────────────────────────────────────────────────────────────
  const prY  = spY + 70;
  const barW = 572;
  const barH = 9;

  // Labels
  setFont(ctx, 600, 12, 'Inter');
  ctx.fillStyle = T.textMuted;
  ctx.fillText('LEVEL PROGRESS', lx, prY);

  const xpText = `${fmtComma(stats.current)} / ${fmtComma(stats.needed)} XP`;
  setFont(ctx, 600, 12, 'Inter');
  const xpW = ctx.measureText(xpText).width;
  ctx.fillStyle = T.accent;
  ctx.fillText(xpText, lx + barW - xpW, prY);

  // Track
  const bY = prY + 10;
  box(ctx, lx, bY, barW, barH, 5, 'rgba(255,255,255,0.07)');

  // Fill
  const fillW = Math.max(barH, barW * stats.progress);
  const barG  = ctx.createLinearGradient(lx, bY, lx + fillW, bY);
  barG.addColorStop(0,   '#00d4c8');
  barG.addColorStop(0.65,'#00aaff');
  barG.addColorStop(1,   '#7c6dff');
  box(ctx, lx, bY, fillW, barH, 5, barG);

  // Sheen on fill
  ctx.save();
  rr(ctx, lx, bY, fillW, barH, 5);
  ctx.clip();
  const sheen = ctx.createLinearGradient(lx, bY, lx, bY + barH);
  sheen.addColorStop(0,   'rgba(255,255,255,0.32)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(lx, bY, fillW, barH);
  ctx.restore();

  // End dot
  const dotX = lx + fillW;
  const dotY = bY + barH / 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
  ctx.fillStyle = T.accent;
  ctx.fill();

  // Hint
  setFont(ctx, 400, 12, 'Inter');
  ctx.fillStyle = T.textMuted;
  const rem = stats.needed - stats.current;
  ctx.fillText(`${fmtComma(rem)} XP until next role`, lx, bY + barH + 18);

  // ── STAT PILLS ──────────────────────────────────────────────────────────
  const statY  = prY + 88;
  const pillW  = 168;
  const pillH  = 80;
  const pillGp = 16;

  const statsData = [
    { label: 'DAILY XP',    value: fmt(stats.daily), sub: fmtComma(stats.daily)  },
    { label: 'LIFETIME XP', value: fmt(stats.life),  sub: fmtComma(stats.life)   },
    { label: 'STREAK',      value: `${stats.streak}d`, sub: 'day streak'          },
  ];

  statsData.forEach((s, i) => {
    const px = lx + i * (pillW + pillGp);
    const py = statY;

    box(ctx, px, py, pillW, pillH, 12, 'rgba(255,255,255,0.038)');
    strk(ctx, px, py, pillW, pillH, 12, T.border, 1);

    // Top accent line
    const acLine = ctx.createLinearGradient(px, py, px + pillW, py);
    acLine.addColorStop(0,   'rgba(0,212,200,0)');
    acLine.addColorStop(0.5, T.accent);
    acLine.addColorStop(1,   'rgba(0,212,200,0)');
    ctx.strokeStyle = acLine;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 12, py);
    ctx.lineTo(px + pillW - 12, py);
    ctx.stroke();

    setFont(ctx, 600, 10, 'Inter');
    ctx.fillStyle = T.textMuted;
    ctx.fillText(s.label, px + 14, py + 20);

    setFont(ctx, 900, 26, 'Satoshi');
    ctx.fillStyle = T.textHero;
    ctx.fillText(s.value, px + 14, py + 51);

    setFont(ctx, 400, 11, 'Inter');
    ctx.fillStyle = T.textMuted;
    ctx.fillText(s.sub, px + 14, py + 68);
  });

  // ── FOOTER META ─────────────────────────────────────────────────────────
  const metaY = H - 28;

  ctx.strokeStyle = T.border;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(lx, H - 58);
  ctx.lineTo(W - T.pad, H - 58);
  ctx.stroke();

  const metaItems = [
    { label: 'MEMBER SINCE', value: stats.memberSince },
    { label: 'LAST ACTIVE',  value: stats.lastActive  },
  ];

  metaItems.forEach((m, i) => {
    const mx = lx + i * 240;
    setFont(ctx, 600, 10, 'Inter');
    ctx.fillStyle = T.textMuted;
    ctx.fillText(m.label, mx, metaY - 14);
    setFont(ctx, 600, 14, 'Inter');
    ctx.fillStyle = T.textSecondary;
    ctx.fillText(m.value, mx, metaY + 2);
  });

  // Brand mark
  setFont(ctx, 900, 12, 'Satoshi');
  ctx.fillStyle  = 'rgba(0,212,200,0.28)';
  ctx.textAlign  = 'right';
  ctx.fillText('✦ RANK CARD', W - T.pad, metaY + 2);
  ctx.textAlign  = 'left';
}

// ============================================================================
// DRAW: CORNER ACCENT BRACKETS
// ============================================================================

function drawCornerAccents(ctx) {
  const W = T.canvasW;
  const H = T.canvasH;
  const s = 20;
  const m = 16;

  ctx.strokeStyle = T.accent;
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = 'square';

  // top-left
  ctx.beginPath(); ctx.moveTo(m + s, m); ctx.lineTo(m, m); ctx.lineTo(m, m + s); ctx.stroke();
  // top-right
  ctx.beginPath(); ctx.moveTo(W - m - s, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + s); ctx.stroke();
  // bottom-left
  ctx.beginPath(); ctx.moveTo(m + s, H - m); ctx.lineTo(m, H - m); ctx.lineTo(m, H - m - s); ctx.stroke();
  // bottom-right
  ctx.beginPath(); ctx.moveTo(W - m - s, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - s); ctx.stroke();
}

// ============================================================================
// MAIN DRAW
// ============================================================================

function draw(ctx, user, avatar, stats) {
  drawBackground(ctx);
  drawRankWatermark(ctx, stats.rank);
  drawAvatarPanel(ctx, avatar);
  drawContent(ctx, user, stats);
  drawCornerAccents(ctx);
}

// ============================================================================
// RENDER
// ============================================================================

function render({ user, avatar, stats }) {
  const canvas = createCanvas(T.canvasW, T.canvasH);
  const ctx    = canvas.getContext('2d');
  draw(ctx, user, avatar, stats);
  return canvas.toBuffer('image/png');
}

// ============================================================================
// BUILD
// ============================================================================

async function build(user) {
  const avatar = await getAvatar(user);
  const stats  = getStats(user.id);
  return render({ user, avatar, stats });
}

// ============================================================================
// MODULE EXPORT
// ============================================================================

export default {
  name: 'leveling',
  configSchema: LEVELING_SCHEMA,
  events: [],

  commands: [
    {
      name:        'rank',
      description: 'Show rank card',

      async execute(interaction) {
        try {
          log('/rank used by', interaction.user.username);
          const png  = await build(interaction.user);
          const file = new AttachmentBuilder(png, {
            name: `rank-${interaction.user.id}.png`,
          });

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ files: [file] });
          } else {
            await interaction.reply({ files: [file] });
          }
        } catch (e) {
          err('CARD ERROR:', e);
          const msg = '❌ Card generation failed.\n```' +
            (e?.stack?.slice(0, 1800) || e) + '```';
          try {
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply({ content: msg });
            } else {
              await interaction.reply({ content: msg, ephemeral: true });
            }
          } catch (sendErr) {
            err('Failed sending error:', sendErr);
          }
        }
      },
    },
  ],
};

