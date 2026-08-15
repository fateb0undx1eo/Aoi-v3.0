import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { resolve } from 'path';

GlobalFonts.registerFromPath(resolve(import.meta.dirname, '../pollfonts/Inter-Bold.woff2'), 'Inter');
GlobalFonts.registerFromPath(resolve(import.meta.dirname, '../pollfonts/Inter-ExtraBold.woff2'), 'Inter');

const bgPath = resolve(import.meta.dirname, 'vs_bg.png');

export interface VsCardOption {
  imageUrl?: string | null;
  label: string;
}

export interface VsCardStyle {
  badgeLabel?: string;
}

const CANVAS_W = 1200;
const CANVAS_H = 500;
const RADIUS = 16;
const IMG_PAD = 48;
const IMG_GAP = 20;

function drawRoundedRect(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCover(ctx: any, image: any, x: number, y: number, w: number, h: number): void {
  if (!image) {
  ctx.fillStyle = '#18181b';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawImageCard(ctx: any, image: any, x: number, y: number, w: number, h: number): void {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, RADIUS);
  ctx.clip();
  drawCover(ctx, image, x, y, w, h);
  ctx.restore();
}

function drawCoverContain(ctx: any, image: any, x: number, y: number, w: number, h: number): void {
  if (!image) return;
  const scale = Math.min(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawImageCardContain(ctx: any, image: any, x: number, y: number, w: number, h: number): void {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, RADIUS);
  ctx.clip();
  if (!image) {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(x, y, w, h);
  } else {
    drawCoverContain(ctx, image, x, y, w, h);
  }
  ctx.restore();
}

async function loadImageUrl(url: string): Promise<any | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      console.warn(`[pollCanvas] image fetch failed: ${res.status} ${url}`);
      return null;
    }
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch (error: any) {
    console.warn(`[pollCanvas] image fetch error: ${error?.message ?? error} ${url}`);
    return null;
  }
}

let bgImage: any = null;

async function getBackground(): Promise<any> {
  if (bgImage) return bgImage;
  try {
    bgImage = await loadImage(bgPath);
  } catch {
    bgImage = null;
  }
  return bgImage;
}

export async function renderVsCard(options: VsCardOption[], style: VsCardStyle = {}): Promise<Buffer> {
  const valid = options.filter((o) => o.label.trim());
  const count = Math.max(2, valid.length);
  const isPair = count === 2;

  const [bg, ...images] = await Promise.all([
    getBackground(),
    ...valid.map((o) => (o.imageUrl ? loadImageUrl(o.imageUrl) : Promise.resolve(null))),
  ]);

  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext('2d');

  if (bg) {
    const scale = Math.max(CANVAS_W / bg.width, CANVAS_H / bg.height);
    const sw = bg.width * scale;
    const sh = bg.height * scale;
    ctx.drawImage(bg, (CANVAS_W - sw) / 2, (CANVAS_H - sh) / 2, sw, sh);
  } else {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  ctx.save();
  drawRoundedRect(ctx, 0, 0, CANVAS_W, CANVAS_H, RADIUS);
  ctx.clip();

  if (isPair) {
    const halfW = (CANVAS_W - IMG_PAD * 2 - IMG_GAP) / 2;
    const imgH = CANVAS_H - IMG_PAD * 2;
    const leftX = IMG_PAD;
    const rightX = IMG_PAD + halfW + IMG_GAP;
    const imgY = IMG_PAD;

    drawImageCard(ctx, images[0] ?? null, leftX, imgY, halfW, imgH);
    drawImageCard(ctx, images[1] ?? null, rightX, imgY, halfW, imgH);
  } else {
    const cols = 2;
    const rows = Math.ceil(count / cols);
    const gap = 16;
    const pad = IMG_PAD;
    const cellW = (CANVAS_W - pad * 2 - gap * (cols - 1)) / cols;
    const cellH = (CANVAS_H - pad * 2 - gap * (rows - 1)) / rows;

    valid.forEach((_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = pad + col * (cellW + gap);
      const y = pad + row * (cellH + gap);
      drawImageCard(ctx, images[index] ?? null, x, y, cellW, cellH);
    });
  }

  // VS / OR text — centered, single clean draw with a soft shadow for legibility
  const label = style.badgeLabel ?? 'VS';
  ctx.font = '800 64px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textX = CANVAS_W / 2;
  const textY = CANVAS_H / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, textX, textY);
  ctx.restore();

  ctx.restore();
  return canvas.toBuffer('image/png');
}

/**
 * Renders a rectangular (4:1) Spotify-style song card: the VS background with
 * the track cover on the left and the song name + artist on the right.
 */
const TRACK_W = 400;
const TRACK_H = 100;
const TRACK_PAD = 12;
const TRACK_RADIUS = 14;
const TRACK_SCALE = 1.2;

function truncateToWidth(ctx: any, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

function formatTrackDuration(seconds?: number | null): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function drawPauseIcon(ctx: any, cx: number, cy: number, r: number): void {
  ctx.fillStyle = '#ffffff';
  const bw = r * 0.26;
  const bh = r * 0.92;
  const gap = r * 0.34;
  const rad = bw / 2;
  drawRoundedRect(ctx, cx - gap / 2 - bw, cy - bh / 2, bw, bh, rad);
  ctx.fill();
  drawRoundedRect(ctx, cx + gap / 2, cy - bh / 2, bw, bh, rad);
  ctx.fill();
}

function drawSkipIcon(ctx: any, cx: number, cy: number, r: number, dir: number): void {
  ctx.fillStyle = '#ffffff';
  const bw = r * 0.26;
  const bh = r * 0.92;
  const tipX = cx + dir * (r * 0.4);
  const tw = r * 0.62;
  const th = r * 0.92;
  const apexX = tipX + dir * tw;
  ctx.beginPath();
  if (dir < 0) {
    ctx.moveTo(tipX, cy - th / 2);
    ctx.lineTo(tipX, cy + th / 2);
    ctx.lineTo(apexX, cy);
  } else {
    ctx.moveTo(tipX, cy - th / 2);
    ctx.lineTo(tipX, cy + th / 2);
    ctx.lineTo(apexX, cy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  const barX = dir < 0 ? apexX - bw : apexX;
  drawRoundedRect(ctx, barX, cy - bh / 2, bw, bh, bw / 2);
  ctx.fill();
}

export async function renderTrackCard(imageUrl: string, label = '', artist = '', duration?: number | null): Promise<Buffer> {
  const image = await loadImageUrl(imageUrl);

  const canvas = createCanvas(TRACK_W * TRACK_SCALE, TRACK_H * TRACK_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(TRACK_SCALE, TRACK_SCALE);
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';

  // Dark background fill (darker than #242429), with rounded corners.
  ctx.save();
  drawRoundedRect(ctx, 0, 0, TRACK_W, TRACK_H, TRACK_RADIUS);
  ctx.clip();
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, TRACK_W, TRACK_H);
  ctx.restore();

  // Square cover on the left — contained so the whole image shows (no crop).
  const coverSize = TRACK_H - TRACK_PAD * 2;
  drawImageCardContain(ctx, image, TRACK_PAD, TRACK_PAD, coverSize, coverSize);

  // Text block to the right of the cover.
  const textX = TRACK_PAD + coverSize + 12;
  const textMaxW = TRACK_W - textX - TRACK_PAD;
  const name = label.trim();
  const by = artist.trim();

  ctx.textBaseline = 'alphabetic';
  if (name) {
    ctx.font = '800 18px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(truncateToWidth(ctx, name, textMaxW), textX, TRACK_PAD + 18);
  }
  if (by) {
    ctx.font = '500 10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#b3b3b3';
    ctx.fillText(truncateToWidth(ctx, by, textMaxW), textX, TRACK_PAD + 34);
  }

  // Progress bar below the artist: a shorter gray track with a pure-white pill
  // fill at a random position (looks like it's being played). No knob; rounded
  // ends. The track duration sits at the bottom-right of the bar.
  const barY = TRACK_PAD + 50;
  const barX = textX;
  const barRightPad = 56;
  const barW = textMaxW - barRightPad;
  const barH = 3;
  const fillW = barW * Math.random();

  // Punch the track area fully transparent so it reads as a single transparent
  // layer (not the dark card background showing through behind it).
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fill();
  ctx.restore();
  if (fillW > 0) {
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, barX, barY, fillW, barH, barH / 2);
    ctx.fill();
  }

  const durText = formatTrackDuration(duration);
  if (durText) {
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(durText, barX + barW, barY + 14);
    ctx.textAlign = 'left';
  }

  // Transport controls below the bar (skip-left, play, skip-right) — Spotify style,
  // centered under the bar, evenly spaced.
  const ctrlY = 79;
  const playR = 11;
  const skipS = playR;
  const playCx = barX + barW / 2;
  const gap = 22;
  drawSkipIcon(ctx, playCx - gap, ctrlY, skipS, -1);
  drawPauseIcon(ctx, playCx, ctrlY, playR);
  drawSkipIcon(ctx, playCx + gap, ctrlY, skipS, 1);

  return canvas.toBuffer('image/png');
}
