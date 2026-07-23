import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FONT_NAMES = ['Caveat', 'Patrick Hand', 'Kalam', 'Indie Flower'];
const FONT_FILES = [
  'Caveat-Regular.ttf',
  'PatrickHand-Regular.ttf',
  'Kalam-Regular.ttf',
  'IndieFlower-Regular.ttf'
];

function loadFonts(): void {
  const fontDir = join(__dirname, 'fonts');
  if (!existsSync(fontDir)) {
    mkdirSync(fontDir, { recursive: true });
  }
  for (let i = 0; i < FONT_NAMES.length; i++) {
    const fontPath = join(fontDir, FONT_FILES[i]!);
    if (existsSync(fontPath)) {
      try {
        GlobalFonts.registerFromPath(fontPath, FONT_NAMES[i]!);
      } catch {}
    }
  }
}

loadFonts();

const HANDWRITING_FONT = `"Caveat", "Patrick Hand", "Kalam", "Indie Flower", "Comic Sans MS", cursive`;

interface AvatarPosition {
  x: number;
  y: number;
  anchor: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
}

interface TextPosition {
  x: number;
  y: number;
  align: string;
}

const AVATAR_POSITIONS: AvatarPosition[] = [
  { x: 100, y: 100, anchor: 'topleft' },
  { x: 850, y: 100, anchor: 'topright' },
  { x: 100, y: 350, anchor: 'bottomleft' },
  { x: 850, y: 350, anchor: 'bottomright' },
];

const TEXT_POSITIONS: Record<string, TextPosition> = {
  topleft:     { x: 550, y: 100, align: 'left' },
  topright:    { x: 100, y: 100, align: 'left' },
  bottomleft:  { x: 550, y: 100, align: 'left' },
  bottomright: { x: 100, y: 100, align: 'left' },
};

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generatePointatImage(avatarUrl: string, text: string): Promise<Buffer> {
  const width = 1200;
  const height = 675;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';

  ctx.fillStyle = '#313338';
  ctx.fillRect(0, 0, width, height);

  let avatar: any;
  try {
    avatar = await loadImage(avatarUrl);
  } catch {}

  const avatarSize = randInt(180, 260);
  const avatarChoice = pick(AVATAR_POSITIONS);
  const avatarPos = { x: avatarChoice.x, y: avatarChoice.y };
  const avatarCenter = { x: avatarPos.x + avatarSize / 2, y: avatarPos.y + avatarSize / 2 };
  const avatarRotation = rand(-5, 5) * (Math.PI / 180);

  const fontSize = randInt(36, 52);
  const maxTextWidth = 400;
  ctx.font = `${fontSize}px ${HANDWRITING_FONT}`;
  const lines = wrapText(ctx, text, maxTextWidth);
  const lineHeight = fontSize * 1.3;
  const textBlockH = lines.length * lineHeight;
  const textBlockW = lines.reduce((m: number, l: string) => Math.max(m, ctx.measureText(l).width), 0);

  const textAnchor = TEXT_POSITIONS[avatarChoice.anchor]!;
  let textX = textAnchor.x;
  let textY = textAnchor.y;

  let attempts = 0;
  const minDistance = 400;
  let textCenter = { x: textX + textBlockW / 2, y: textY + textBlockH / 2 };

  while (dist(textCenter.x, textCenter.y, avatarCenter.x, avatarCenter.y) < minDistance && attempts < 100) {
    const angle = Math.atan2(textCenter.y - avatarCenter.y, textCenter.x - avatarCenter.x);
    const pushDistance = minDistance - dist(textCenter.x, textCenter.y, avatarCenter.x, avatarCenter.y) + 50;

    textX += Math.cos(angle) * pushDistance * 0.5;
    textY += Math.sin(angle) * pushDistance * 0.5;

    textX = Math.max(50, Math.min(width - textBlockW - 50, textX));
    textY = Math.max(50, Math.min(height - textBlockH - 50, textY));

    textCenter = { x: textX + textBlockW / 2, y: textY + textBlockH / 2 };
    attempts++;
  }

  const textRotation = rand(-8, 8) * (Math.PI / 180);

  ctx.save();
  ctx.translate(textCenter.x, textCenter.y);
  ctx.rotate(textRotation);
  ctx.translate(-textCenter.x, -textCenter.y);

  {
    const padding = 20;
    ctx.fillStyle = '#2b2d31';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(
      textX - padding, textY - padding,
      textBlockW + padding * 2, textBlockH + padding * 2,
      8
    );
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = '#dbdee1';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, textX, textY + i * lineHeight);
  }
  ctx.restore();

  const textBlockCenter = {
    x: textX + textBlockW / 2,
    y: textY + textBlockH / 2
  };

  ctx.save();
  ctx.translate(avatarCenter.x, avatarCenter.y);
  ctx.rotate(avatarRotation);
  ctx.translate(-avatarCenter.x, -avatarCenter.y);

  ctx.beginPath();
  ctx.arc(avatarCenter.x, avatarCenter.y, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatar) {
    ctx.drawImage(avatar, avatarPos.x, avatarPos.y, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#5865F2';
    ctx.fillRect(avatarPos.x, avatarPos.y, avatarSize, avatarSize);
  }

  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenter.x, avatarCenter.y, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  const avatarRadius = avatarSize / 2 + 10;

  const textBlockLeft = textX;
  const textBlockRight = textX + textBlockW;
  const textBlockTop = textY;
  const textBlockBottom = textY + textBlockH;

  const dx = avatarCenter.x - textBlockCenter.x;
  const dy = avatarCenter.y - textBlockCenter.y;

  let textEdgePoint = { x: textBlockCenter.x, y: textBlockCenter.y };

  if (dx !== 0 || dy !== 0) {
    const tValues: { t: number; side: string; x?: number; y?: number }[] = [];

    if (dx !== 0) {
      const tLeft = (textBlockLeft - textBlockCenter.x) / dx;
      const tRight = (textBlockRight - textBlockCenter.x) / dx;
      if (tLeft > 0) tValues.push({ t: tLeft, side: 'left', y: textBlockCenter.y + tLeft * dy });
      if (tRight > 0) tValues.push({ t: tRight, side: 'right', y: textBlockCenter.y + tRight * dy });
    }

    if (dy !== 0) {
      const tTop = (textBlockTop - textBlockCenter.y) / dy;
      const tBottom = (textBlockBottom - textBlockCenter.y) / dy;
      if (tTop > 0) tValues.push({ t: tTop, side: 'top', x: textBlockCenter.x + tTop * dx });
      if (tBottom > 0) tValues.push({ t: tBottom, side: 'bottom', x: textBlockCenter.x + tBottom * dx });
    }

    let minT = Infinity;
    for (const point of tValues) {
      if (point.t < minT && point.t > 0) {
        const px = point.x !== undefined ? point.x : textBlockCenter.x + point.t * dx;
        const py = point.y !== undefined ? point.y : textBlockCenter.y + point.t * dy;

        if (px >= textBlockLeft - 1 && px <= textBlockRight + 1 &&
            py >= textBlockTop - 1 && py <= textBlockBottom + 1) {
          minT = point.t;
          textEdgePoint = { x: px, y: py };
        }
      }
    }
  }

  const arrowEnd = {
    x: avatarCenter.x - (dx / Math.hypot(dx, dy)) * avatarRadius,
    y: avatarCenter.y - (dy / Math.hypot(dx, dy)) * avatarRadius
  };

  const edgeDx = textEdgePoint.x - textBlockCenter.x;
  const edgeDy = textEdgePoint.y - textBlockCenter.y;
  const edgeLen = Math.hypot(edgeDx, edgeDy) || 1;
  const arrowStart = {
    x: textEdgePoint.x + (edgeDx / edgeLen) * 15,
    y: textEdgePoint.y + (edgeDy / edgeLen) * 15
  };

  const arrowThickness = randInt(5, 8);
  const arrowColor = '#ffffff';

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = arrowThickness + 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(arrowStart.x + 2, arrowStart.y + 2);

  const midX = (arrowStart.x + arrowEnd.x) / 2;
  const midY = (arrowStart.y + arrowEnd.y) / 2;

  const perpDx = -(arrowEnd.y - arrowStart.y) / (Math.hypot(arrowEnd.x - arrowStart.x, arrowEnd.y - arrowStart.y) || 1);
  const perpDy = (arrowEnd.x - arrowStart.x) / (Math.hypot(arrowEnd.x - arrowStart.x, arrowEnd.y - arrowStart.y) || 1);
  const curveAmount = rand(-30, 30);

  const cpx = midX + perpDx * curveAmount + 2;
  const cpy = midY + perpDy * curveAmount + 2;

  ctx.quadraticCurveTo(cpx, cpy, arrowEnd.x + 2, arrowEnd.y + 2);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = arrowThickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(arrowStart.x, arrowStart.y);
  ctx.quadraticCurveTo(
    midX + perpDx * curveAmount,
    midY + perpDy * curveAmount,
    arrowEnd.x,
    arrowEnd.y
  );
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(arrowEnd.x + 2, arrowEnd.y + 2, arrowThickness * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = arrowColor;
  ctx.beginPath();
  ctx.arc(arrowEnd.x, arrowEnd.y, arrowThickness * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(arrowStart.x, arrowStart.y, arrowThickness * 1.2, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer('image/png');
}
