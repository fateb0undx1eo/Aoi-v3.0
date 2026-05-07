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
    data[i] += noise;     // R
    data[i + 1] += noise; // G
    data[i + 2] += noise; // B
  }

  ctx.putImageData(imageData, x, y);
}

// ============================================================================
// STATS (TEMP)
// ============================================================================

function getStats(id) {
  const seed = Number(String(id).slice(-6));

  const current = 2900 + (seed % 500);
  const needed = 5000;

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
    const url = user.displayAvatarURL({
      extension: 'png',
      size: 512
    });

    const res = await fetch(url);
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch (e) {
    err('Avatar error:', e);
    return null;
  }
}

// ============================================================================
// BACKGROUND
// ============================================================================

function drawBg(ctx) {
  // Pure black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CARD.w, CARD.h);

  const cardX = 30;
  const cardY = 30;
  const cardW = CARD.w - 60;
  const cardH = CARD.h - 60;
  const cardR = 28;

  // Subtle corner glow (right side only)
  const glowGradient = ctx.createRadialGradient(CARD.w - 100, 100, 50, CARD.w - 100, 100, 400);
  glowGradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
  glowGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.05)');
  glowGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
  
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, CARD.w, CARD.h);

  // Card background (pure black)
  box(ctx, cardX, cardY, cardW, cardH, cardR, '#000000');

  // Subtle border
  stroke(ctx, cardX, cardY, cardW, cardH, cardR, 'rgba(168, 85, 247, 0.3)', 1.5);

  // Whitish polish on right edge
  const polishGradient = ctx.createLinearGradient(CARD.w - 150, 0, CARD.w - 50, 0);
  polishGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  polishGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
  polishGradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
  
  ctx.fillStyle = polishGradient;
  round(ctx, CARD.w - 150, cardY, 120, cardH, cardR);
  ctx.fill();
}

// ============================================================================
// LEFT SECTION CARD (with noise texture)
// ============================================================================

function drawLeftCard(ctx) {
  const x = 60;
  const y = 60;
  const w = 400;
  const h = 572;
  const r = 20;

  // Black card background
  box(ctx, x, y, w, h, r, '#000000');

  // Add noise texture
  addNoise(ctx, x, y, w, h, 0.05);

  // Subtle border
  stroke(ctx, x, y, w, h, r, 'rgba(255, 255, 255, 0.05)', 1);
}

// ============================================================================
// AVATAR WITH GRADIENT RING
// ============================================================================

function drawAvatar(ctx, img) {
  const x = 110;
  const y = 90;
  const size = 280;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const radius = size / 2;

  // Gradient ring
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, '#a855f7');
  gradient.addColorStop(0.5, '#ec4899');
  gradient.addColorStop(1, '#8b5cf6');

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Inner dark ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0e1f';
  ctx.fill();

  // Clip for avatar
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

  // Sparkle icon near avatar
  drawSparkle(ctx, x + size + 10, y + size - 30);
}

// ============================================================================
// SPARKLE ICON
// ============================================================================

function drawSparkle(ctx, x, y) {
  const size = 28;
  ctx.save();
  ctx.translate(x, y);

  // Outer glow
  ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
  ctx.shadowBlur = 10;

  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  
  // Draw 4-pointed star
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI / 2) - Math.PI / 4;
    const x1 = Math.cos(angle) * size;
    const y1 = Math.sin(angle) * size;
    const x2 = Math.cos(angle + Math.PI / 4) * (size * 0.4);
    const y2 = Math.sin(angle + Math.PI / 4) * (size * 0.4);
    
    if (i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ============================================================================
// RANKED USER BADGE
// ============================================================================

function drawRankedBadge(ctx) {
  const x = CARD.w - 320;
  const y = 90;
  const w = 240;
  const h = 50;

  // Badge background
  box(ctx, x, y, w, h, 12, 'rgba(139, 92, 246, 0.15)');
  stroke(ctx, x, y, w, h, 12, 'rgba(139, 92, 246, 0.4)', 1.5);

  // Icon
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.arc(x + 30, y + 25, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 45, y + 25, 8, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = '#a0a0c0';
  font(ctx, 600, 18, 'Inter');
  ctx.fillText('RANKED USER', x + 70, y + 32);
}

// ============================================================================
// USER INFO
// ============================================================================

function drawUserInfo(ctx, user) {
  const x = 520;
  const y = 140; // Moved down from 120

  // Username
  ctx.fillStyle = '#ffffff';
  font(ctx, 900, 68, 'Satoshi');
  ctx.fillText(user.globalName || user.username, x, y);

  // Handle
  ctx.fillStyle = '#6b7280';
  font(ctx, 400, 28, 'Inter');
  ctx.fillText(`@${user.username}`, x, y + 50);
}

// ============================================================================
// WEEKLY PROGRESS
// ============================================================================

function drawWeeklyProgress(ctx, stats) {
  const x = 520;
  const y = 260; // Adjusted position
  const barW = 550;
  const barH = 50;

  // Label
  ctx.fillStyle = '#6b7280';
  font(ctx, 600, 20, 'Inter');
  ctx.fillText('WEEKLY PROGRESS', x, y - 10);

  // Progress bar background
  box(ctx, x, y, barW, barH, 25, 'rgba(255, 255, 255, 0.05)');

  // Progress bar fill
  const fillW = Math.max(80, barW * stats.progress);
  const gradient = ctx.createLinearGradient(x, y, x + fillW, y);
  gradient.addColorStop(0, '#a855f7');
  gradient.addColorStop(1, '#8b5cf6');
  
  box(ctx, x, y, fillW, barH, 25, gradient);

  // Progress text
  ctx.fillStyle = '#ffffff';
  font(ctx, 700, 24, 'Inter');
  const progressText = `${fmt(stats.current)} / ${fmt(stats.needed)}`;
  ctx.fillText(progressText, x + barW / 2 - ctx.measureText(progressText).width / 2, y + 34);

  // Percentage
  ctx.fillStyle = '#6b7280';
  font(ctx, 600, 22, 'Inter');
  const percentage = `${Math.round(stats.progress * 100)}%`;
  ctx.fillText(percentage, x + barW + 30, y + 34);

  // Next role text
  ctx.fillStyle = '#a855f7';
  font(ctx, 400, 20, 'Inter');
  const needed = stats.needed - stats.current;
  ctx.fillText(`↗ ${fmt(needed)} more for next role`, x, y + 75);
}

// ============================================================================
// RANK NUMBER
// ============================================================================

function drawRankNumber(ctx, rank) {
  const x = 110;
  const y = 500;

  // Rank number with gradient
  const gradient = ctx.createLinearGradient(x, y - 100, x, y);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#a855f7');

  ctx.fillStyle = gradient;
  font(ctx, 900, 120, 'Satoshi');
  ctx.fillText(`#${rank}`, x, y);

  // Label
  ctx.fillStyle = '#a855f7';
  font(ctx, 700, 22, 'Inter');
  ctx.fillText('GLOBAL RANK', x, y + 35);
}

// ============================================================================
// STATUS BADGE
// ============================================================================

function drawStatusBadge(ctx) {
  const x = 110;
  const y = 570;
  const w = 280;
  const h = 50;

  // Badge background
  box(ctx, x, y, w, h, 25, 'rgba(34, 197, 94, 0.1)');
  stroke(ctx, x, y, w, h, 25, 'rgba(34, 197, 94, 0.5)', 2);

  // Green dot
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(x + 35, y + 25, 8, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = '#22c55e';
  font(ctx, 700, 22, 'Inter');
  ctx.fillText('SUPER ACTIVE', x + 60, y + 32);
}

// ============================================================================
// STAT CARD
// ============================================================================

function drawStatCard(ctx, x, y, icon, label, value, subtext) {
  const w = 260;
  const h = 150;
  const r = 20;

  // Card background - darker for black theme
  box(ctx, x, y, w, h, r, 'rgba(20, 20, 20, 0.6)');
  stroke(ctx, x, y, w, h, r, 'rgba(255, 255, 255, 0.06)', 1);

  // Icon background
  const iconSize = 60;
  const iconX = x + 30;
  const iconY = y + 30;
  box(ctx, iconX, iconY, iconSize, iconSize, 12, 'rgba(168, 85, 247, 0.12)');

  // Draw icon
  ctx.fillStyle = '#a855f7';
  drawIcon(ctx, icon, iconX + iconSize / 2, iconY + iconSize / 2);

  // Label
  ctx.fillStyle = '#6b7280';
  font(ctx, 600, 16, 'Inter');
  ctx.fillText(label, x + iconX + iconSize + 20 - x, y + 45);

  // Value
  ctx.fillStyle = '#ffffff';
  font(ctx, 700, 38, 'Inter');
  ctx.fillText(value, x + iconX + iconSize + 20 - x, y + 85);

  // Subtext
  if (subtext) {
    ctx.fillStyle = '#4b5563';
    font(ctx, 400, 16, 'Inter');
    ctx.fillText(subtext, x + iconX + iconSize + 20 - x, y + 110);
  }
}

// ============================================================================
// ICON DRAWING
// ============================================================================

function drawIcon(ctx, type, x, y) {
  ctx.save();
  ctx.translate(x, y);

  switch (type) {
    case 'chat':
      // Chat bubble
      ctx.beginPath();
      ctx.roundRect(-18, -12, 36, 24, 4);
      ctx.fill();
      // Lines inside
      ctx.fillStyle = '#0a0e1f';
      ctx.fillRect(-12, -6, 24, 3);
      ctx.fillRect(-12, 3, 16, 3);
      break;

    case 'trophy':
      // Trophy cup
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.lineTo(-8, 8);
      ctx.lineTo(8, 8);
      ctx.lineTo(12, -8);
      ctx.closePath();
      ctx.fill();
      // Base
      ctx.fillRect(-14, 8, 28, 4);
      ctx.fillRect(-10, 12, 20, 3);
      // Handles
      ctx.beginPath();
      ctx.arc(-12, -4, 4, 0, Math.PI * 2);
      ctx.arc(12, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'calendar':
      // Calendar body
      ctx.fillRect(-14, -8, 28, 22);
      // Top bar
      ctx.fillStyle = '#0a0e1f';
      ctx.fillRect(-14, -8, 28, 6);
      // Rings
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-10, -12, 3, 6);
      ctx.fillRect(7, -12, 3, 6);
      break;

    case 'bolt':
      // Lightning bolt
      ctx.beginPath();
      ctx.moveTo(2, -16);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-6, 16);
      ctx.lineTo(8, -4);
      ctx.lineTo(2, -4);
      ctx.closePath();
      ctx.fill();
      break;

    case 'clock':
      // Circle
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      // Hands
      ctx.strokeStyle = '#0a0e1f';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

// ============================================================================
// FOOTER INFO
// ============================================================================

function drawFooter(ctx, stats) {
  const y = 590; // Moved up from 620
  const iconSize = 24;
  const spacing = 280;

  // Member since
  drawFooterItem(ctx, 540, y, 'calendar', 'Member since', stats.memberSince);

  // Activity streak
  drawFooterItem(ctx, 540 + spacing, y, 'bolt', 'Activity streak', `${stats.streak} days`);

  // Last active
  drawFooterItem(ctx, 540 + spacing * 2, y, 'clock', 'Last active', stats.lastActive);
}

function drawFooterItem(ctx, x, y, icon, label, value) {
  // Icon
  ctx.fillStyle = '#4b5563';
  drawIcon(ctx, icon, x, y);

  // Label
  ctx.fillStyle = '#4b5563';
  font(ctx, 400, 16, 'Inter');
  ctx.fillText(label, x + 35, y - 4);

  // Value
  ctx.fillStyle = '#d1d5db';
  font(ctx, 600, 18, 'Inter');
  ctx.fillText(value, x + 35, y + 18);
}

// ============================================================================
// MAIN DRAW
// ============================================================================

function draw(ctx, user, avatar, stats) {
  drawBg(ctx);
  drawLeftCard(ctx); // Draw the textured left section card first
  drawAvatar(ctx, avatar);
  drawRankedBadge(ctx);
  drawUserInfo(ctx, user);
  drawWeeklyProgress(ctx, stats);
  drawRankNumber(ctx, stats.rank);
  drawStatusBadge(ctx);

  // Stat cards
  drawStatCard(ctx, 540, 370, 'chat', 'DAILY XP', fmt(stats.daily), fmtComma(stats.daily));
  drawStatCard(ctx, 830, 370, 'trophy', 'LIFETIME XP', fmt(stats.life), fmtComma(stats.life));

  // Footer
  drawFooter(ctx, stats);
}

// ============================================================================
// RENDER
// ============================================================================

function render({ user, avatar, stats }) {
  const canvas = createCanvas(CARD.w, CARD.h);
  const ctx = canvas.getContext('2d');

  draw(ctx, user, avatar, stats);

  return canvas.toBuffer('image/png');
}

// ============================================================================
// BUILD
// ============================================================================

async function build(user) {
  const avatar = await getAvatar(user);
  const stats = getStats(user.id);

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

          const png = await build(interaction.user);

          const file = new AttachmentBuilder(png, {
            name: `rank-${interaction.user.id}.png`
          });

          // SAFE RESPONSE HANDLING
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

