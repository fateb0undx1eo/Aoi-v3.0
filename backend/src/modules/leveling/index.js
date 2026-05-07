import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

// ============================================================================
// REQUIRED FOR LOADER
// ============================================================================

const LEVELING_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: true
};

// ============================================================================
// PATHS
// ============================================================================

const FONT_DIR = path.join(
  process.cwd(),
  'src',
  'modules',
  'leveling',
  'assets',
  'fonts'
);

// ============================================================================
// LOGGING
// ============================================================================

const log = (...a) => console.log('[LEVELING]', ...a);
const err = (...a) => console.error('[LEVELING]', ...a);

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

    load('Satoshi-Black.otf', 'Satoshi', '900');
    load('Satoshi-Bold.otf', 'Satoshi', '700');
    load('Inter_24pt-SemiBold.ttf', 'Inter', '600');
    load('Inter_24pt-Regular.ttf', 'Inter', '400');
  } catch (e) {
    err('Font load error:', e);
  }
}

loadFonts();

// ============================================================================
// COLOR PALETTE — edit here to retheme the entire card
// ============================================================================

const COLORS = {
  // Backgrounds
  background:        '#000000',
  cardBg:            'rgba(20, 20, 20, 0.6)',   // left panel + stat cards
  cardBgStroke:      'rgba(255, 255, 255, 0.06)',

  // Accent / brand
  primary:           '#a855f7',
  primaryLight:      '#8b5cf6',
  primaryMid:        '#9333ea',
  primaryGlow:       'rgba(139, 92, 246, 0.15)',
  primaryGlowSoft:   'rgba(139, 92, 246, 0.05)',
  primaryBorder:     'rgba(168, 85, 247, 0.3)',
  primaryIconBg:     'rgba(168, 85, 247, 0.12)',

  // Status
  active:            '#22c55e',
  activeBg:          'rgba(34, 197, 94, 0.1)',
  activeBorder:      'rgba(34, 197, 94, 0.5)',

  // Text
  textPrimary:       '#ffffff',
  textSecondary:     '#d1d5db',
  textTertiary:      '#6b7280',
  textMuted:         '#4b5563',

  // Misc overlays
  overlayLight:      'rgba(255, 255, 255, 0.05)',
  overlayPure:       'rgba(0, 0, 0, 0)',

  // Avatar ring
  avatarRingA:       '#a855f7',
  avatarRingB:       '#ec4899',
  avatarRingC:       '#8b5cf6',
  avatarRingInner:   '#0a0e1f',

  // Icon inner fill (cutout colour)
  iconCutout:        '#0a0e1f',
};

// ============================================================================
// CARD CONFIG
// ============================================================================

const CARD = {
  w: 1360,
  h: 692
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

function fmtComma(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================================
// NOISE TEXTURE
// ============================================================================

function addNoise(ctx, x, y, w, h, opacity = 0.03) {
  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * opacity;
    data[i]     += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imageData, x, y);
}

// ============================================================================
// STATS (TEMP)
// ============================================================================

function getStats(id) {
  const seed = Number(String(id).slice(-6));
  const current = 2900 + (seed % 500);
  const needed  = 5000;

  return {
    rank: 43,
    current,
    needed,
    progress: current / needed,
    daily: 3521,
    life: 89121,
    memberSince: 'Jan 12, 2024',
    streak: 28,
    lastActive: '5m ago'
  };
}

// ============================================================================
// AVATAR
// ============================================================================

async function getAvatar(user) {
  try {
    const url = user.displayAvatarURL({ extension: 'png', size: 512 });
    const res  = await fetch(url);
    if (!res.ok) return null;
    const buf  = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch (e) {
    err('Avatar error:', e);
    return null;
  }
}

// ============================================================================
// BACKGROUND  — no outer border ring
// ============================================================================

function drawBg(ctx) {
  // Pure black canvas
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CARD.w, CARD.h);

  // Subtle corner glow (top-right)
  const glowGradient = ctx.createRadialGradient(
    CARD.w - 100, 100, 50,
    CARD.w - 100, 100, 400
  );
  glowGradient.addColorStop(0, COLORS.primaryGlow);
  glowGradient.addColorStop(0.5, COLORS.primaryGlowSoft);
  glowGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, CARD.w, CARD.h);
}

// ============================================================================
// LEFT SECTION CARD — same colour as stat cards
// ============================================================================

function drawLeftCard(ctx) {
  const x = 40;
  const y = 40;
  const w = 420;
  const h = CARD.h - 80;
  const r = 20;

  box(ctx, x, y, w, h, r, COLORS.cardBg);
  addNoise(ctx, x, y, w, h, 0.05);
  stroke(ctx, x, y, w, h, r, COLORS.cardBgStroke, 1);
}

// ============================================================================
// AVATAR WITH GRADIENT RING
// ============================================================================

function drawAvatar(ctx, img) {
  const x    = 90;
  const y    = 80;
  const size = 280;
  const cx   = x + size / 2;
  const cy   = y + size / 2;
  const radius = size / 2;

  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, COLORS.avatarRingA);
  gradient.addColorStop(0.5, COLORS.avatarRingB);
  gradient.addColorStop(1, COLORS.avatarRingC);

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.avatarRingInner;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y, size, size);
  }

  ctx.restore();

  drawSparkle(ctx, x + size + 10, y + size - 30);
}

// ============================================================================
// SPARKLE ICON
// ============================================================================

function drawSparkle(ctx, x, y) {
  const size = 28;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = COLORS.primary;
  ctx.beginPath();

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI / 2) - Math.PI / 4;
    const x1    = Math.cos(angle) * size;
    const y1    = Math.sin(angle) * size;
    const x2    = Math.cos(angle + Math.PI / 4) * (size * 0.4);
    const y2    = Math.sin(angle + Math.PI / 4) * (size * 0.4);
    if (i === 0) ctx.moveTo(x1, y1);
    else         ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }

  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.restore();
}

// ============================================================================
// USER INFO
// ============================================================================

function drawUserInfo(ctx, user) {
  const x = 520;
  const y = 140;

  ctx.fillStyle = COLORS.textPrimary;
  font(ctx, 900, 68, 'Satoshi');
  ctx.fillText(user.globalName || user.username, x, y);

  ctx.fillStyle = COLORS.textTertiary;
  font(ctx, 400, 28, 'Inter');
  ctx.fillText(`@${user.username}`, x, y + 50);
}

// ============================================================================
// WEEKLY PROGRESS
// — label above bar at the LEFT, percentage badge removed
// ============================================================================

function drawWeeklyProgress(ctx, stats) {
  const x    = 520;
  const y    = 260;
  const barW = 550;
  const barH = 50;

  // Label — left-aligned, above the bar
  ctx.fillStyle = COLORS.textTertiary;
  font(ctx, 600, 20, 'Inter');
  ctx.fillText('WEEKLY PROGRESS', x, y - 14);

  // Bar background
  box(ctx, x, y, barW, barH, 25, COLORS.overlayLight);

  // Bar fill
  const fillW    = Math.max(80, barW * stats.progress);
  const gradient = ctx.createLinearGradient(x, y, x + fillW, y);
  gradient.addColorStop(0, COLORS.primary);
  gradient.addColorStop(1, COLORS.primaryLight);
  box(ctx, x, y, fillW, barH, 25, gradient);

  // XP text centred on bar
  ctx.fillStyle = COLORS.textPrimary;
  font(ctx, 700, 24, 'Inter');
  const progressText = `${fmt(stats.current)} / ${fmt(stats.needed)}`;
  ctx.fillText(
    progressText,
    x + barW / 2 - ctx.measureText(progressText).width / 2,
    y + 34
  );

  // "More for next role" hint
  ctx.fillStyle = COLORS.primary;
  font(ctx, 400, 20, 'Inter');
  const needed = stats.needed - stats.current;
  ctx.fillText(`↗ ${fmt(needed)} more for next role`, x, y + 75);
}

// ============================================================================
// RANK NUMBER
// ============================================================================

function drawRankNumber(ctx, rank) {
  const x = 90;
  const y = 500;

  const gradient = ctx.createLinearGradient(x, y - 100, x, y);
  gradient.addColorStop(0, COLORS.textPrimary);
  gradient.addColorStop(1, COLORS.primary);

  ctx.fillStyle = gradient;
  font(ctx, 900, 120, 'Satoshi');
  ctx.fillText(`#${rank}`, x, y);

  ctx.fillStyle = COLORS.primary;
  font(ctx, 700, 22, 'Inter');
  ctx.fillText('GLOBAL RANK', x, y + 35);
}

// ============================================================================
// STATUS BADGE — compact, fits "SUPER ACTIVE" comfortably
// ============================================================================

function drawStatusBadge(ctx) {
  const x   = 90;
  const y   = 570;
  const h   = 42;
  const pad = 22;

  // Measure text width so badge auto-sizes
  font(ctx, 700, 20, 'Inter');
  const dotDiameter = 12;
  const gap         = 10;
  const textW       = ctx.measureText('SUPER ACTIVE').width;
  const w           = pad + dotDiameter + gap + textW + pad;

  box(ctx, x, y, w, h, 21, COLORS.activeBg);
  stroke(ctx, x, y, w, h, 21, COLORS.activeBorder, 1.5);

  // Green dot
  ctx.fillStyle = COLORS.active;
  ctx.beginPath();
  ctx.arc(x + pad + dotDiameter / 2, y + h / 2, dotDiameter / 2, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = COLORS.active;
  ctx.fillText('SUPER ACTIVE', x + pad + dotDiameter + gap, y + h / 2 + 7);
}

// ============================================================================
// STAT CARD — with better SVG-style path icons
// ============================================================================

function drawStatCard(ctx, x, y, icon, label, value, subtext) {
  const w = 260;
  const h = 150;
  const r = 20;

  box(ctx, x, y, w, h, r, COLORS.cardBg);
  stroke(ctx, x, y, w, h, r, COLORS.cardBgStroke, 1);

  const iconSize = 60;
  const iconX    = x + 30;
  const iconY    = y + 30;
  box(ctx, iconX, iconY, iconSize, iconSize, 12, COLORS.primaryIconBg);

  ctx.fillStyle   = COLORS.primary;
  ctx.strokeStyle = COLORS.primary;
  drawIcon(ctx, icon, iconX + iconSize / 2, iconY + iconSize / 2);

  const textX = iconX + iconSize + 20;

  ctx.fillStyle = COLORS.textTertiary;
  font(ctx, 600, 16, 'Inter');
  ctx.fillText(label, textX, y + 45);

  ctx.fillStyle = COLORS.textPrimary;
  font(ctx, 700, 38, 'Inter');
  ctx.fillText(value, textX, y + 85);

  if (subtext) {
    ctx.fillStyle = COLORS.textMuted;
    font(ctx, 400, 16, 'Inter');
    ctx.fillText(subtext, textX, y + 110);
  }
}

// ============================================================================
// ICON DRAWING — clean SVG-style path icons
// ============================================================================

function drawIcon(ctx, type, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  switch (type) {

    // Outlined chat bubble with tail
    case 'chat': {
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.strokeStyle = COLORS.primary;
      round(ctx, -14, -13, 28, 20, 5);
      ctx.stroke();
      // Tail
      ctx.beginPath();
      ctx.moveTo(-6, 7);
      ctx.lineTo(-10, 14);
      ctx.lineTo(-1, 7);
      ctx.stroke();
      // Dots inside
      ctx.fillStyle = COLORS.primary;
      [-8, 0, 8].forEach(dx => {
        ctx.beginPath();
        ctx.arc(dx, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }

    // Clean trophy outline
    case 'trophy': {
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.strokeStyle = COLORS.primary;

      // Cup body
      ctx.beginPath();
      ctx.moveTo(-10, -14);
      ctx.lineTo(-10,  2);
      ctx.quadraticCurveTo(-10, 10, 0, 10);
      ctx.quadraticCurveTo(10, 10, 10, 2);
      ctx.lineTo(10, -14);
      ctx.closePath();
      ctx.stroke();

      // Handles
      ctx.beginPath();
      ctx.moveTo(-10, -8);
      ctx.quadraticCurveTo(-17, -8, -17, -2);
      ctx.quadraticCurveTo(-17, 4, -10, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, -8);
      ctx.quadraticCurveTo(17, -8, 17, -2);
      ctx.quadraticCurveTo(17, 4, 10, 4);
      ctx.stroke();

      // Stem + base
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-9, 15);
      ctx.lineTo(9, 15);
      ctx.stroke();
      break;
    }

    // Calendar icon with rings and grid dots
    case 'calendar': {
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.strokeStyle = COLORS.primary;

      // Body
      round(ctx, -13, -10, 26, 24, 4);
      ctx.stroke();

      // Top bar
      ctx.beginPath();
      ctx.moveTo(-13, -3);
      ctx.lineTo(13, -3);
      ctx.stroke();

      // Rings
      [-6, 6].forEach(dx => {
        ctx.beginPath();
        ctx.moveTo(dx, -14);
        ctx.lineTo(dx, -7);
        ctx.stroke();
      });

      // Grid dots (2×2)
      ctx.fillStyle = COLORS.primary;
      [[-6, 3], [0, 3], [6, 3], [-6, 9], [0, 9], [6, 9]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }

    // Lightning bolt — filled
    case 'bolt': {
      ctx.fillStyle = COLORS.primary;
      ctx.beginPath();
      ctx.moveTo(3,  -16);
      ctx.lineTo(-7,  2);
      ctx.lineTo(-1,  2);
      ctx.lineTo(-5,  16);
      ctx.lineTo(9,  -4);
      ctx.lineTo(3,  -4);
      ctx.closePath();
      ctx.fill();
      break;
    }

    // Clock with hands
    case 'clock': {
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      ctx.strokeStyle = COLORS.primary;

      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();

      // Hour hand (pointing ~10 o'clock)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-5, -7);
      ctx.stroke();

      // Minute hand (pointing ~2 o'clock)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(7, -4);
      ctx.stroke();

      // Centre dot
      ctx.fillStyle = COLORS.primary;
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

// ============================================================================
// FOOTER INFO
// ============================================================================

function drawFooter(ctx, stats) {
  const y       = 590;
  const spacing = 280;

  drawFooterItem(ctx, 540,              y, 'calendar', 'Member since',   stats.memberSince);
  drawFooterItem(ctx, 540 + spacing,    y, 'bolt',     'Activity streak', `${stats.streak} days`);
  drawFooterItem(ctx, 540 + spacing * 2, y, 'clock',   'Last active',    stats.lastActive);
}

function drawFooterItem(ctx, x, y, icon, label, value) {
  ctx.fillStyle   = COLORS.textMuted;
  ctx.strokeStyle = COLORS.textMuted;
  drawIcon(ctx, icon, x, y);

  ctx.fillStyle = COLORS.textMuted;
  font(ctx, 400, 16, 'Inter');
  ctx.fillText(label, x + 35, y - 4);

  ctx.fillStyle = COLORS.textSecondary;
  font(ctx, 600, 18, 'Inter');
  ctx.fillText(value, x + 35, y + 18);
}

// ============================================================================
// MAIN DRAW
// ============================================================================

function draw(ctx, user, avatar, stats) {
  drawBg(ctx);
  drawLeftCard(ctx);
  drawAvatar(ctx, avatar);
  drawUserInfo(ctx, user);
  drawWeeklyProgress(ctx, stats);
  drawRankNumber(ctx, stats.rank);
  drawStatusBadge(ctx);

  drawStatCard(ctx, 540, 370, 'chat',   'DAILY XP',    fmt(stats.daily), fmtComma(stats.daily));
  drawStatCard(ctx, 830, 370, 'trophy', 'LIFETIME XP', fmt(stats.life),  fmtComma(stats.life));

  drawFooter(ctx, stats);
}

// ============================================================================
// RENDER
// ============================================================================

function render({ user, avatar, stats }) {
  const canvas = createCanvas(CARD.w, CARD.h);
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
      name: 'rank',
      description: 'Show rank card',

      async execute(interaction) {
        try {
          log('/rank used by', interaction.user.username);

          const png  = await build(interaction.user);
          const file = new AttachmentBuilder(png, {
            name: `rank-${interaction.user.id}.png`
          });

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ files: [file] });
          } else {
            await interaction.reply({ files: [file] });
          }

        } catch (e) {
          err('CARD ERROR:', e);

          const msg =
            '❌ Card generation failed.\n```' +
            (e?.stack?.slice(0, 1800) || e) +
            '```';

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
      }
    }
  ]
};

