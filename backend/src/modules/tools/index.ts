import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import chroma from 'chroma-js';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { getOrCreateBadgeEmoji } from '../../utils/badgeEmojis.js';
import { logger } from '../../utils/logger.js';
import type { BotContext, InteractionResult, ModuleDefinition } from '../../types/index.js';

// ─── Point At Fonts ─────────────────────────────────────────────

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
        registerFont(fontPath, { family: FONT_NAMES[i]! });
      } catch {
        // font already registered or unavailable
      }
    }
  }
}

loadFonts();

const HANDWRITING_FONT = `"Caveat", "Patrick Hand", "Kalam", "Indie Flower", "Comic Sans MS", cursive`;

// ─── Point At Custom ID helpers ─────────────────────────────────

const PT_PREFIX = 'pt';

interface PtParsedCid {
  action: string;
  userId: string;
  data: string[];
}

function cidPoint(action: string, userId: string, ...extra: string[]): string {
  return [PT_PREFIX, action, userId, ...extra].join(':');
}

function parsePointCid(customId: string): PtParsedCid | null {
  const parts = customId.split(':');
  if (parts[0] !== PT_PREFIX || parts.length < 3) return null;
  return { action: parts[1]!, userId: parts[2]!, data: parts.slice(3) };
}

// ─── Point At Image Gen ─────────────────────────────────────────

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

async function generatePointatImage(avatarUrl: string, text: string): Promise<Buffer> {
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

// ─── Role Color helpers ─────────────────────────────────────────

function formatTimestamp(): string {
  const now = new Date();
  const time = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `Today at ${time}`;
}

const XKCD: [any, string][] = [
  [0x000000,'black'],[0xffffff,'white'],[0xdddddd,'light grey'],[0xcccccc,'grey'],[0x333333,'dark grey'],
  [0x111111,'almost black'],[0xff0000,'red'],[0xcc0000,'dark red'],[0x990000,'blood red'],[0x660000,'maroon'],
  [0xff4444,'bright red'],[0xff6666,'pinkish red'],[0xffcccc,'pale red'],[0xff8888,'salmon'],
  [0xffa07a,'light salmon'],[0xff4500,'orangered'],[0xff6347,'tomato'],[0xdc143c,'crimson'],
  [0xb22222,'firebrick'],[0xe60000,'cherry red'],[0xbf0000,'brick red'],[0xc0392b,'rust red'],
  [0xe74c3c,'pomegranate'],[0xff6600,'orange'],[0xff9900,'bright orange'],[0xffa500,'tangerine'],
  [0xff8c00,'dark orange'],[0xff7f50,'coral'],[0xffb347,'pastel orange'],[0xffd700,'gold'],
  [0xffcc00,'yellow orange'],[0xffbf00,'amber'],[0xf39c12,'honey'],[0xffff00,'yellow'],
  [0xffff66,'light yellow'],[0xffff99,'pale yellow'],[0xfffccc,'cream'],[0xfffacd,'lemon chiffon'],
  [0xf1c40f,'sunflower'],[0xf7dc6f,'butter'],[0xf9e79f,'pale gold'],[0xf4d03f,'banana'],
  [0xccff00,'chartreuse'],[0xadff2f,'greenyellow'],[0x7fff00,'lime'],[0x00ff00,'neon green'],
  [0x32cd32,'lime green'],[0x00cc00,'vibrant green'],[0x009900,'green'],[0x006600,'dark green'],
  [0x228b22,'forest green'],[0x2ecc71,'emerald'],[0x27ae60,'sea green'],[0x1abc9c,'teal green'],
  [0x2e8b57,'seaweed'],[0x3cb371,'medium green'],[0x66cd00,'bright green'],[0x98fb98,'pale green'],
  [0x90ee90,'light green'],[0x8fbc8f,'dark sea green'],[0x556b2f,'olive green'],[0x6b8e23,'olive drab'],
  [0x9acd32,'yellow green'],[0x00ff80,'spring green'],[0x00fa9a,'medium spring green'],[0x7fffd4,'aquamarine'],
  [0x00ffff,'cyan'],[0x00cccc,'teal'],[0x008080,'dark teal'],[0x0088ff,'ocean blue'],
  [0x00bfff,'deep sky blue'],[0x87ceeb,'sky blue'],[0x87cefa,'light sky blue'],[0xadd8e6,'light blue'],
  [0xb0e0e6,'powder blue'],[0x00aaff,'azure'],[0x0077ff,'blue'],[0x0000ff,'bright blue'],
  [0x0000cc,'medium blue'],[0x000099,'dark blue'],[0x000066,'navy'],[0x1e90ff,'dodger blue'],
  [0x4169e1,'royal blue'],[0x4682b4,'steel blue'],[0x5f9ea0,'cadet blue'],[0x6495ed,'cornflower'],
  [0x34495e,'dark slate'],[0x2c3e50,'midnight'],[0x2980b9,'ocean'],[0x3498db,'cerulean'],
  [0x8e44ad,'purple'],[0x9b59b6,'amethyst'],[0x800080,'dark purple'],[0x4b0082,'indigo'],
  [0x6a5acd,'slate blue'],[0x483d8b,'dark slate blue'],[0x7b68ee,'medium slate blue'],[0x9370db,'medium purple'],
  [0x8a2be2,'blue violet'],[0x9400d3,'dark violet'],[0x9932cc,'dark orchid'],[0xba55d3,'medium orchid'],
  [0xda70d6,'orchid'],[0xee82ee,'violet'],[0xdda0dd,'plum'],[0xff00ff,'magenta'],[0xcc00cc,'bright magenta'],
  [0xff1493,'deep pink'],[0xff69b4,'hot pink'],[0xffb6c1,'light pink'],[0xffc0cb,'pink'],
  [0xdb7093,'pale violet red'],[0xc71585,'medium violet red'],[0xe91e63,'raspberry'],
  [0x800000,'burgundy'],[0xa0522d,'sienna'],[0x8b4513,'saddle brown'],[0xd2691e,'chocolate'],
  [0xcd853f,'peru'],[0xdeb887,'burlywood'],[0xd2b48c,'tan'],[0xbc8f8f,'rosy brown'],
  [0xf4a460,'sandy brown'],[0xdaa520,'goldenrod'],[0xb8860b,'dark goldenrod'],[0x8b6914,'dark mustard'],
  [0x964b00,'brown'],[0x6b3a2a,'dark brown'],[0x3e2723,'very dark brown'],[0x8d6e63,'warm brown'],
  [0xa1887f,'dusty brown'],[0x808080,'grey'],[0xa9a9a9,'dark grey'],[0xd3d3d3,'light grey'],
  [0xf5f5f5,'white smoke'],[0xf8f8ff,'ghost white'],[0x95a5a6,'grey blue'],[0x7f8c8d,'greyish'],
  [0xbdc3c7,'silver'],[0xecf0f1,'off white'],[0xfdf5e6,'old lace'],[0xfffaf0,'floral white'],
  [0xfff8e7,'coconut'],[0xe6e6fa,'lavender'],[0xf0f8ff,'alice blue'],[0xf5fffa,'mint'],
  [0xf0ffff,'azure'],[0xfffff0,'ivory'],[0xfaf0e6,'linen'],[0xfff5ee,'seashell'],
  [0xfff0f5,'lavender blush'],[0xffe4e1,'misty rose'],[0xffdead,'navajo white'],[0xf5deb3,'wheat'],
  [0xffe4c4,'bisque'],[0xf0e68c,'khaki'],[0xbdb76b,'dark khaki'],[0xeee8aa,'pale goldenrod'],
  [0xf5f5dc,'beige'],[0xffffe0,'light yellow'],[0xf0fff0,'honeydew'],[0xffe5b4,'peach'],
  [0xffdab9,'peach puff'],[0xffcba4,'apricot'],[0xffb07c,'cantaloupe'],[0xfa8072,'salmon'],
  [0xe9967a,'dark salmon'],[0xf08080,'light coral'],[0xcd5c5c,'indian red'],[0xc08080,'old rose'],
  [0xe8adad,'rose gold'],[0xfb607f,'rose'],[0xff91a4,'pink rose'],[0xff3855,'watermelon'],
  [0xc41e3a,'cardinal'],[0x960018,'ruby'],[0x800020,'wine'],[0x722f37,'wine red'],
  [0x673147,'aubergine'],[0x7b1113,'cherry'],[0xf19cbb,'candy pink'],[0xff66cc,'pink magenta'],
  [0xe3256b,'razzmatazz'],[0xfe28a2,'persian rose'],[0xde5d83,'blush'],[0xb3446c,'dark rose'],
  [0xdf00ff,'psychedelic purple'],[0xbf00ff,'electric purple'],[0x9900ff,'purple blue'],
  [0x7a5dc7,'lavender purple'],[0x563c5c,'purplish'],[0x301934,'dark purple'],
  [0x191970,'midnight blue'],[0x120a8f,'ultramarine'],[0x000080,'navy blue'],[0x002366,'royal navy'],
  [0x003153,'prussian blue'],[0x004b87,'cobalt'],[0x007ba7,'cerulean'],[0x00a86b,'jade'],
  [0x00ff7f,'spring green'],[0x50c878,'emerald green'],[0x4fffb0,'mint green'],[0x00ced1,'turquoise'],
  [0x40e0d0,'bright turquoise'],[0x48d1cc,'medium turquoise'],[0x20b2aa,'light sea green'],
  [0x008b8b,'dark cyan'],[0x006994,'blue green'],[0x005b96,'peacock blue'],[0x0f52ba,'sapphire'],
  [0x1434a4,'egyptian blue'],[0x7ff000,'lime green'],[0xccff66,'light neon green'],
  [0x808000,'olive'],[0x004b23,'dark forest green'],[0x002200,'pine green'],[0x1b4d3e,'dark green blue'],
  [0xd4af37,'metallic gold'],[0xaa6c39,'bronze'],[0x8b8589,'pewter'],[0x6699cc,'blue grey'],
  [0x6082b6,'glaucous'],[0x536872,'slate grey'],[0x36454f,'charcoal'],[0x28282b,'onyx'],
  [0x353839,'dark charcoal'],[0x8c92ac,'grey purple'],[0x71706e,'warm grey'],[0xbbb8b0,'cool grey'],
  [0xdcdcdc,'gainsboro'],[0xefdfbb,'dusty white'],[0xf1e7d0,'eggshell'],[0xf7efe2,'bone'],
  [0xe8d5b7,'almond'],[0xeddcc9,'ivory'],[0xf6e9d7,'cream']
].map(([h, n]) => [chroma(h as number), n] as [any, string]);

function hexToColorName(hex: string): string {
  const target = chroma(hex.replace('#', ''));
  let closest = hex.toUpperCase();
  let minDist = Infinity;
  for (const [color, name] of XKCD) {
    const d = chroma.deltaE(target, color);
    if (d < minDist) { minDist = d; closest = name; }
  }
  return closest.charAt(0).toUpperCase() + closest.slice(1);
}

async function generatePreview(avatarUrl: string, username: string, hexColor: string, hex2Color: string | null): Promise<Buffer> {
  const width = 480;
  const height = 130;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#313338';
  ctx.fillRect(0, 0, width, height);

  let avatar: any;
  try {
    const res = await fetch(avatarUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    avatar = await loadImage(buf);
  } catch {
    avatar = null;
  }

  const avatarSize = 48;
  const avatarX = 19;
  const avatarY = 39;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#5865F2';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  const textX = avatarX + avatarSize + 14;
  const textY = 53;

  const hex = hexColor.replace('#', '');
  const timestamp = formatTimestamp();

  ctx.font = '400 14px sans-serif';
  const tsWidth = ctx.measureText(timestamp).width;
  const gap = 10;
  const rightMargin = 20;
  const maxNameWidth = width - textX - tsWidth - gap - rightMargin;

  ctx.font = '600 18px sans-serif';
  let displayName = username;
  let nameWidth = ctx.measureText(displayName).width;
  if (nameWidth > maxNameWidth) {
    while (ctx.measureText(displayName + '...').width > maxNameWidth && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '...';
    nameWidth = ctx.measureText(displayName).width;
  }

  if (hex2Color) {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, hexColor);
    gradient.addColorStop(1, hex2Color);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = `#${hex}`;
  }
  ctx.fillText(displayName, textX, textY);

  ctx.font = '400 14px sans-serif';
  ctx.fillStyle = '#949ba4';
  ctx.fillText(timestamp, textX + nameWidth + gap, textY);

  ctx.font = '400 18px sans-serif';
  ctx.fillStyle = '#dbdee1';
  ctx.fillText('Hello I am on Discord', textX, textY + 33);

  return canvas.toBuffer('image/png');
}

// ─── Role Color Custom ID helpers ───────────────────────────────

const RC_PREFIX = 'rc';

interface RcParsedCid {
  action: string;
  userId: string;
  data: string[];
}

function cidRole(action: string, userId: string, ...extra: string[]): string {
  return [RC_PREFIX, action, userId, ...extra].join(':');
}

function parseRoleCid(customId: string): RcParsedCid | null {
  const parts = customId.split(':');
  if (parts[0] !== RC_PREFIX || parts.length < 3) return null;
  return { action: parts[1]!, userId: parts[2]!, data: parts.slice(3) };
}

// ─── Role Editor Component Builders ────────────────────────────

function buildRoleSelect(userId: string): RoleSelectMenuBuilder {
  return new RoleSelectMenuBuilder()
    .setCustomId(cidRole('role', userId))
    .setPlaceholder('Select a role...')
    .setMinValues(1)
    .setMaxValues(1);
}

function buildActionSelect(userId: string, roleId: string): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(cidRole('action', userId, roleId))
    .setPlaceholder('Choose an action...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions([
      { label: 'CHANGE COLOR', value: 'color' },
      { label: 'CHANGE NAME', value: 'name' },
      { label: 'CHANGE ICON', value: 'icon' }
    ]);
}

function buildInitialContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# Role Editor')
    );
}

function buildPreviewContainer(userId: string, hex: string, roleId: string, roleName: string, colorOverride: string | null, hex2: string | null, hex3: string | null): ContainerBuilder {
  const colorName = colorOverride || hexToColorName(hex);
  let colorText: string;
  if (hex3) {
    colorText = `**Style:** Holographic\n**Primary:** ${hex.toUpperCase()}\n**Secondary:** ${hex2!.toUpperCase()}\n**Tertiary:** ${hex3.toUpperCase()}`;
  } else if (hex2) {
    colorText = `**Gradient:** ${hex.toUpperCase()} → ${hex2.toUpperCase()}`;
  } else {
    colorText = `**Color:** ${colorName}\n**Hex:** ${hex.toUpperCase()}`;
  }
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Role Editor')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Role:** <@&${roleId}>\n${colorText}`)
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://preview.png')
      )
    );
}

function buildResultContainer(message: string): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Role Editor')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(message)
    );
}

function errorEdit(message: string): InteractionResult {
  return { type: 'EDIT_REPLY', components: [buildResultContainer(message)] } as InteractionResult;
}

// ─── Unified Interaction Result Helper ──────────────────────────

const R = {
  ignore:      (): InteractionResult                             => ({ type: 'IGNORE' }),
  error:       (message: string): InteractionResult               => ({ type: 'ERROR', message }),
  editReply:   (content: string, opts: any = {})                  => ({ type: 'EDIT_REPLY' as const, content, components: opts.components, files: opts.files }),
  update:      (opts: any = {})                                   => ({ type: 'UPDATE' as const, content: opts.content, components: opts.components, files: opts.files, allowedMentions: opts.allowedMentions }),
  modal:       (builder: ModalBuilder): InteractionResult         => ({ type: 'MODAL', modal: builder }),
};

// ─── Config Schema ──────────────────────────────────────────────

const TOOLS_SCHEMA = {
  type: 'object',
  properties: {
    autoresponder_enabled: { type: 'boolean' },
    embed_creator_enabled: { type: 'boolean' },
    sticky_enabled: { type: 'boolean' },
    staff_list: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        channel_id: { type: 'string' },
        update_mode: { type: 'string' },
        existing_message_link: { type: 'string' },
        intro_text: { type: 'string' },
        auto_update_on_role_change: { type: 'boolean' },
        show_join_date: { type: 'boolean' },
        interval_value: { type: 'number' },
        interval_unit: { type: 'string' },
        staff_role_ids: { type: 'array', items: { type: 'string' } },
        rank_tier_role_ids: { type: 'array', items: { type: 'string' } }
      }
    },
    channels_activity: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        default_delete_seconds: { type: 'number' }
      }
    }
  }
} as const;

// ─── Module Definition ──────────────────────────────────────────

export default {
  name: 'tools',
  display_name: 'Tools',
  configSchema: TOOLS_SCHEMA,
  commands: [
    // ── /channel broadcast ──
    {
      name: 'channel',
      description: 'Send a message to every sendable channel in the server',
      ephemeral: true,
      permissionOverrides: {
        discordPermissions: ['Administrator']
      },
      options: [
        {
          name: 'all',
          type: 1,
          description: 'Broadcast to all channels',
          options: [
            {
              name: 'message',
              type: 3,
              description: 'Message to send to all channels',
              required: true
            },
            {
              name: 'delete_after_seconds',
              type: 4,
              description: 'Optional override for auto-delete timing',
              required: false,
              min_value: 0,
              max_value: 3600
            }
          ] as any[]
        }
      ],
      async execute(interaction: any, { services }: BotContext): Promise<InteractionResult> {
        const subcommand = interaction.options.getSubcommand(true);
        if (subcommand !== 'all') {
          await interaction.editReply('Unsupported channel action.');
          return { type: 'IGNORE' };
        }

        const content = interaction.options.getString('message', true).trim();
        if (!content) {
          await interaction.editReply('Provide a message to broadcast.');
          return { type: 'IGNORE' };
        }

        const config = await services.toolsService.getChannelActivityConfig(interaction.guildId);
        const overrideDeleteSeconds = interaction.options.getInteger('delete_after_seconds');
        const deleteAfterSeconds = overrideDeleteSeconds ?? (
          config.enabled ? config.default_delete_seconds : 0
        );

        const result = await services.toolsService.broadcastToGuildChannels(
          interaction.guild,
          content,
          deleteAfterSeconds
        );

        await interaction.editReply(
          [
            `Broadcast attempted in ${result.attempted} channel${result.attempted === 1 ? '' : 's'}.`,
            `Sent: ${result.sent}.`,
            `Failed: ${result.failed}.`,
            deleteAfterSeconds > 0
              ? `Messages will delete after ${deleteAfterSeconds} second${deleteAfterSeconds === 1 ? '' : 's'}.`
              : 'Messages will stay until removed manually.'
          ].join('\n')
        );

        return { type: 'IGNORE' };
      }
    },

    // ── /user info ──
    {
      name: 'user',
      description: 'User information commands',
      ephemeral: false,
      options: [
        {
          name: 'info',
          type: 1,
          description: 'Show user information',
          options: [
            {
              name: 'user',
              type: 6,
              description: 'The user to show info for',
              required: false
            }
          ]
        }
      ],
      async execute(interaction: any, context: BotContext): Promise<InteractionResult> {
        if (interaction.options.getSubcommand(true) !== 'info') {
          await interaction.editReply('Unknown subcommand.');
          return { type: 'IGNORE' };
        }

        const targetUser = interaction.options.getUser('user') ?? interaction.user;
        const targetMember = interaction.guild
          ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
          : null;

        const fullUser = await context.discordClient.users.fetch(targetUser.id, { force: true })
          .catch(() => targetUser);

        const bodyLines: string[] = [];

        bodyLines.push('-# USER INFO');

        let mentionLine = targetUser.toString();
        const primaryGuild = fullUser.primaryGuild ?? null;

        if (primaryGuild) {
          let badgeText = '';
          let tagText = '';

          const badge = primaryGuild.badge;
          if (badge) {
            let badgeUrl: string | null = null;
            if (typeof badge?.url === 'string') {
              badgeUrl = badge.url;
            } else if (typeof badge === 'string') {
              badgeUrl = badge;
            }

            if (badgeUrl?.startsWith('https://')) {
              try {
                const emojiId = await getOrCreateBadgeEmoji(context.discordClient, badgeUrl);
                if (emojiId) {
                  const emojiName = `badge_${badgeUrl.split('/').pop()!.replace('.png', '').slice(0, 8)}`;
                  badgeText = ` <${emojiName}:${emojiId}>`;
                }
              } catch {
                // badge emoji unavailable, skip it
              }
            }
          }

          if (primaryGuild.identityEnabled && primaryGuild.tag) {
            tagText = ` ${primaryGuild.tag}`;
          }

          mentionLine += `${badgeText}${tagText}`;
        }

        bodyLines.push(mentionLine);
        bodyLines.push(`**Username**: \`${targetUser.username}\``);
        bodyLines.push(`**UserID**: \`${targetUser.id}\``);
        bodyLines.push('-# MEMBER SINCE');

        const createdTimestamp = Math.floor(targetUser.createdAt.getTime() / 1000);
        bodyLines.push(`**Account created**: <t:${createdTimestamp}:D>`);

        if (targetMember?.joinedAt) {
          const joinedTimestamp = Math.floor(targetMember.joinedAt.getTime() / 1000);
          bodyLines.push(`**Server joined**: <t:${joinedTimestamp}:D>`);
        }

        const bodyContent = bodyLines.join('\n');

        const containerComponents: any[] = [];

        let bannerUrl: string | null = null;
        if (targetMember?.guildBanner) {
          bannerUrl = targetMember.guildBannerURL({ size: 1024 });
        }
        if (!bannerUrl && fullUser.banner) {
          bannerUrl = fullUser.bannerURL({ size: 1024 });
        }

        if (bannerUrl) {
          containerComponents.push({
            type: 12,
            items: [{ media: { url: bannerUrl } }]
          });
        }

        const avatarUrl = (targetMember ?? targetUser).displayAvatarURL({ size: 512 });
        if (bodyContent) {
          containerComponents.push({
            type: 9,
            components: [{
              type: 10,
              content: bodyContent
            }],
            accessory: {
              type: 11,
              media: { url: avatarUrl }
            }
          });
        }

        const buttons: any[] = [];

        if (targetMember) {
          const roles = targetMember.roles.cache.filter((r: any) => r.name !== '@everyone');
          if (roles.size > 0) {
            buttons.push({
              type: 2,
              label: 'ROLES',
              custom_id: `roles_${targetUser.id}`,
              style: 2
            });
          }
        }

        const decorUrl = fullUser.avatarDecorationURL?.();
        if (decorUrl) {
          buttons.push({
            type: 2,
            label: 'DECOR',
            url: decorUrl,
            style: 5
          });
        }

        if (buttons.length > 0) {
          containerComponents.push({
            type: 1,
            components: buttons
          });
        }

        const components = [{
          type: 17,
          components: containerComponents
        }];

        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components,
          allowedMentions: { parse: [] }
        });

        return { type: 'IGNORE' };
      }
    },

    // ── /role editor ──
    {
      name: 'role',
      defer: false,
      description: 'Role management commands',
      ephemeral: false,
      options: [
        {
          name: 'editor',
          type: 1,
          description: "Edit a role's color with a live preview"
        }
      ],
      async execute(interaction: any, context: BotContext): Promise<InteractionResult> {
        if (interaction.options.getSubcommand(true) !== 'editor') {
          return R.error('Unknown subcommand.');
        }

        const member = interaction.member;
        if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return R.error('You need the Manage Roles permission.');
        }

        const guild = interaction.guild;
        const roles = guild.roles.cache
          .filter((r: any) => r.id !== guild.id && r.editable)
          .sort((a: any, b: any) => b.position - a.position);

        if (roles.size === 0) {
          return R.error('No editable roles found.');
        }

        const userId = interaction.user.id;

        const container = buildInitialContainer()
          .addActionRowComponents((row: any) =>
            row.setComponents(buildRoleSelect(userId))
          )
          .addActionRowComponents((row: any) =>
            row.setComponents(
              new ButtonBuilder()
                .setCustomId(cidRole('confirm', userId))
                .setStyle(ButtonStyle.Secondary)
                .setLabel('CONFIRM')
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(cidRole('cancel', userId))
                .setStyle(ButtonStyle.Secondary)
                .setLabel('CANCEL')
            )
          );

        await interaction.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });

        return { type: 'IGNORE' };
      }
    },

    // ── /point at ──
    {
      name: 'point',
      description: 'Point at someone',
      defer: false,
      ephemeral: false,
      options: [
        {
          name: 'at',
          type: 1,
          description: 'Point at a user with a message',
          options: [
            {
              name: 'user',
              type: 6,
              description: 'The user to point at',
              required: true
            }
          ]
        }
      ],
      async execute(interaction: any, context: BotContext): Promise<InteractionResult> {
        if (interaction.options.getSubcommand(true) !== 'at') {
          return R.error('Unknown subcommand.');
        }

        const target = interaction.options.getUser('user');
        const userId = interaction.user.id;

        const modal = new ModalBuilder()
          .setTitle('Point At')
          .setCustomId(cidPoint('submit', userId, target.id))
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>()
              .addComponents(
                new TextInputBuilder()
                  .setCustomId('message')
                  .setLabel('What should point at this user?')
                  .setStyle(TextInputStyle.Paragraph)
                  .setMaxLength(200)
                  .setRequired(true)
                  .setPlaceholder('Enter your message here...')
              )
          );

        return R.modal(modal);
      }
    }
  ],
  events: [
    // ── Autoresponder ──
    {
      name: 'messageCreate',
      async execute(message: any, { services, placeholderEngine }: BotContext): Promise<void> {
        if (!message.guild || message.author.bot) return;

        const autoresponders = await services.toolsService.listAutoresponders(message.guild.id);
        for (const row of autoresponders) {
          if (!row.enabled) continue;
          const content = message.content.toLowerCase();
          const trigger = String(row.trigger_pattern).toLowerCase();
          const matched = row.match_type === 'exact' ? content === trigger : content.includes(trigger);
          if (!matched) continue;

          const rendered = placeholderEngine.render(row.response_template, {
            user: {
              id: message.author.id,
              username: message.author.username
            }
          });
          await message.channel.send({ content: rendered });
        }
      }
    },

    // ── Staff list role change ──
    {
      name: 'guildMemberUpdate',
      async execute(oldMember: any, newMember: any, { services }: BotContext): Promise<void> {
        await services.staffListService.handleRoleChange(oldMember, newMember);
      }
    },

    // ── /user info roles button ──
    {
      name: 'interactionCreate',
      async execute(interaction: any): Promise<InteractionResult | undefined> {
        if (interaction.isCommand()) return;
        if (!interaction.isButton() || !interaction.customId.startsWith('roles_')) {
          return;
        }

        const userId = interaction.customId.split('_')[1] as string;

        const member = interaction.guild?.members.cache.get(userId);
        if (!member) {
          return { type: 'REPLY', message: 'User not found in this server.', ephemeral: true };
        }

        const roles = member.roles.cache
          .filter((r: any) => r.name !== '@everyone')
          .sort((a: any, b: any) => b.position - a.position);

        if (roles.size === 0) {
          return { type: 'REPLY', message: 'This user has no roles.', ephemeral: true };
        }

        const rolesText = roles.map((r: any) => r.toString()).join(' ');

        return { type: 'REPLY', message: rolesText, ephemeral: true, allowedMentions: { parse: [] } };
      }
    },

    // ── Role Editor ──
    {
      name: 'interactionCreate',
      async execute(interaction: any): Promise<InteractionResult | undefined> {
        if (interaction.isCommand()) return undefined;
        if (!interaction.customId) return R.ignore();
        const parsed = parseRoleCid(interaction.customId);
        if (!parsed) return R.ignore();

        const { action, userId, data } = parsed;

        if (interaction.user.id !== userId) {
          return R.error('This panel belongs to another user.');
        }

        if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          return R.error('You need the Manage Roles permission.');
        }

        if (action === 'role' && interaction.isRoleSelectMenu()) {
          return {
            type: 'ASYNC_RESULT',
            execute: async (): Promise<InteractionResult> => {
              const roleId = interaction.values[0];
              const role = interaction.guild.roles.cache.get(roleId);
              if (!role || !role.editable) {
                return errorEdit('This role cannot be edited.');
              }

              if (role.color && !role.colors?.primaryColor) {
                logger.warn('role.color is deprecated, use role.colors.primaryColor instead', { roleId: role.id, guildId: interaction.guild.id });
              }
              const primaryVal = role.colors?.primaryColor ?? role.color;
              const secondaryVal = role.colors?.secondaryColor ?? 0;
              const tertiaryVal = role.colors?.tertiaryColor ?? 0;
              const hasColor = primaryVal !== 0;
              const previewHex = hasColor ? `#${primaryVal.toString(16).padStart(6, '0')}` : '#ffffff';
              const previewHex2 = secondaryVal ? `#${secondaryVal.toString(16).padStart(6, '0')}` : null;
              const previewHex3 = tertiaryVal ? `#${tertiaryVal.toString(16).padStart(6, '0')}` : null;

              const previewBuffer = await generatePreview(
                interaction.user.displayAvatarURL({ extension: 'png', size: 4096 }),
                interaction.member.displayName || interaction.user.username,
                previewHex,
                previewHex2
              );

              const file = new AttachmentBuilder(previewBuffer, { name: 'preview.png' });

              const container = buildPreviewContainer(
                interaction.user.id,
                previewHex,
                roleId,
                role.name,
                hasColor ? null : 'Default',
                previewHex2,
                previewHex3
              )
                .addActionRowComponents((row: any) =>
                  row.setComponents(buildActionSelect(interaction.user.id, roleId))
                )
                .addActionRowComponents((row: any) =>
                  row.setComponents(
                    new ButtonBuilder()
                      .setCustomId(cidRole('confirm', interaction.user.id, roleId))
                      .setStyle(ButtonStyle.Secondary)
                      .setLabel('CONFIRM')
                      .setDisabled(true),
                    new ButtonBuilder()
                      .setCustomId(cidRole('cancel', interaction.user.id))
                      .setStyle(ButtonStyle.Secondary)
                      .setLabel('CANCEL')
                  )
                );

              return {
                type: 'EDIT_REPLY',
                components: [container],
                files: [file],
                allowedMentions: { roles: [] }
              } as InteractionResult;
            }
          };
        }

        if (action === 'action' && interaction.isStringSelectMenu()) {
          const value = interaction.values[0];
          const roleId = data[0];
          if (!roleId) return R.error('Select a role first.');

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return R.error('This role cannot be edited.');
          }

          if (value === 'color') {
            const supportsGradient = interaction.guild.features.includes('ENHANCED_ROLE_COLORS');

            const modalRows: ActionRowBuilder<TextInputBuilder>[] = [
              new ActionRowBuilder<TextInputBuilder>()
                .addComponents(
                  new TextInputBuilder()
                    .setCustomId('hex1')
                    .setLabel('Primary Color')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('ff5733')
                    .setRequired(true)
                    .setMinLength(6)
                    .setMaxLength(6)
                )
            ];

            if (supportsGradient) {
              modalRows.push(
                new ActionRowBuilder<TextInputBuilder>()
                  .addComponents(
                    new TextInputBuilder()
                      .setCustomId('hex2')
                      .setLabel('Secondary Color (optional)')
                      .setStyle(TextInputStyle.Short)
                      .setPlaceholder('0000ff')
                      .setRequired(false)
                      .setMinLength(6)
                      .setMaxLength(6)
                  )
              );
              modalRows.push(
                new ActionRowBuilder<TextInputBuilder>()
                  .addComponents(
                    new TextInputBuilder()
                      .setCustomId('hex3')
                      .setLabel('Tertiary Color (for holographic style)')
                      .setStyle(TextInputStyle.Short)
                      .setPlaceholder('optional')
                      .setRequired(false)
                      .setMinLength(6)
                      .setMaxLength(6)
                  )
              );
            }

            const modal = new ModalBuilder()
              .setTitle('Set Role Color')
              .setCustomId(cidRole('colormodal', userId, roleId, interaction.message.id))
              .addComponents(...modalRows);
            return R.modal(modal);
          }

          if (value === 'name') {
            const modal = new ModalBuilder()
              .setTitle('Change Role Name')
              .setCustomId(cidRole('namemodal', userId, roleId, interaction.message.id))
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>()
                  .addComponents(
                    new TextInputBuilder()
                      .setCustomId('name')
                      .setLabel('New Role Name')
                      .setStyle(TextInputStyle.Short)
                      .setPlaceholder('Enter new role name...')
                      .setRequired(true)
                      .setMinLength(1)
                      .setMaxLength(100)
                      .setValue(role.name)
                  )
              );
            return R.modal(modal);
          }

          if (value === 'icon') {
            if (!interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
              return R.error('You need the Manage Guild Expressions permission to change role icons.');
            }
            const modal = new ModalBuilder()
              .setTitle('Set Role Icon')
              .setCustomId(cidRole('iconmodal', userId, roleId, interaction.message.id))
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>()
                  .addComponents(
                    new TextInputBuilder()
                      .setCustomId('icon')
                      .setLabel('Image URL')
                      .setStyle(TextInputStyle.Short)
                      .setPlaceholder('https://example.com/icon.png')
                      .setRequired(true)
                  )
              );
            return R.modal(modal);
          }
        }

        if (action === 'colormodal' && interaction.isModalSubmit()) {
          const [roleId, messageId] = data;
          if (!roleId) return R.error('Select a role first.');

          const hex1Raw = interaction.fields.getTextInputValue('hex1').trim();
          const hex2Raw = interaction.fields.fields.has('hex2')
            ? (interaction.fields.getTextInputValue('hex2').trim())
            : '';
          const hex3Raw = interaction.fields.fields.has('hex3')
            ? (interaction.fields.getTextInputValue('hex3').trim())
            : '';

          const hex1 = hex1Raw.startsWith('#') ? hex1Raw : '#' + hex1Raw;
          const hex2 = hex2Raw ? (hex2Raw.startsWith('#') ? hex2Raw : '#' + hex2Raw) : null;
          const hex3 = hex3Raw ? (hex3Raw.startsWith('#') ? hex3Raw : '#' + hex3Raw) : null;

          if (!/^#[0-9a-fA-F]{6}$/.test(hex1)) {
            return R.error('Invalid hex color. Use format like `#ff5733`.');
          }
          if (hex2 && !/^#[0-9a-fA-F]{6}$/.test(hex2)) {
            return R.error('Invalid secondary hex color. Use format like `#0000ff`.');
          }
          if (hex3 && !/^#[0-9a-fA-F]{6}$/.test(hex3)) {
            return R.error('Invalid tertiary hex color. Use format like `#00ff00`.');
          }
          if (hex3 && !hex2) {
            return R.error('Tertiary color requires a secondary color.');
          }

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return R.error('This role can no longer be edited.');
          }

          const roleName = role.name || 'Unknown';

          return {
            type: 'ASYNC_RESULT',
            execute: async (): Promise<InteractionResult> => {
              let previewBuffer: Buffer;
              try {
                previewBuffer = await generatePreview(
                  interaction.user.displayAvatarURL({ extension: 'png', size: 4096 }),
                  interaction.member.displayName || interaction.user.username,
                  hex1,
                  hex2
                );
              } catch {
                return { type: 'ERROR', message: 'Failed to generate preview.' };
              }

              const file = new AttachmentBuilder(previewBuffer, { name: 'preview.png' });

              const colorParts = [roleId, hex1.replace('#', '')];
              if (hex2) colorParts.push(hex2.replace('#', ''));
              if (hex3) colorParts.push(hex3.replace('#', ''));

              const container = buildPreviewContainer(interaction.user.id, hex1, roleId, roleName, null, hex2, hex3)
                .addActionRowComponents((row: any) =>
                  row.setComponents(buildActionSelect(interaction.user.id, roleId))
                )
                .addActionRowComponents((row: any) =>
                  row.setComponents(
                    new ButtonBuilder()
                      .setCustomId(cidRole('confirm', interaction.user.id, ...colorParts))
                      .setStyle(ButtonStyle.Secondary)
                      .setLabel('CONFIRM'),
                    new ButtonBuilder()
                      .setCustomId(cidRole('cancel', interaction.user.id))
                      .setStyle(ButtonStyle.Secondary)
                      .setLabel('CANCEL')
                  )
                );

              try {
                const channel = interaction.channel;
                if (!channel) return { type: 'ERROR', message: 'Channel not found.' };
                const msg = await channel.messages.fetch(messageId);
                await msg.edit({ components: [container], files: [file], allowedMentions: { roles: [] } });
              } catch {
                return { type: 'ERROR', message: 'Failed to update preview.' };
              }

              await interaction.deleteReply().catch(() => {});
              return { type: 'IGNORE' };
            }
          };
        }

        if (action === 'namemodal' && interaction.isModalSubmit()) {
          const [roleId, messageId] = data;
          if (!roleId) return R.error('Select a role first.');

          const name = interaction.fields.getTextInputValue('name').trim();
          if (name.length < 1 || name.length > 100) {
            return R.error('Role name must be between 1 and 100 characters.');
          }

          return {
            type: 'ASYNC_RESULT',
            execute: async (): Promise<InteractionResult> => {
              const role = interaction.guild.roles.cache.get(roleId);
              if (!role || !role.editable) {
                return { type: 'ERROR', message: 'This role can no longer be edited.' };
              }

              try {
                await role.setName(name, `Name changed by ${interaction.user.tag}`);
              } catch {
                return { type: 'ERROR', message: 'Failed to update role name.' };
              }

              const container = buildResultContainer(
                `✅ <@&${roleId}> name changed to **${name}**`
              );

              try {
                const msg = await interaction.channel.messages.fetch(messageId);
                await msg.edit({ components: [container], allowedMentions: { roles: [] } });
              } catch {
                return { type: 'ERROR', message: 'Failed to update message.' };
              }

              await interaction.deleteReply().catch(() => {});
              return { type: 'IGNORE' };
            }
          };
        }

        if (action === 'iconmodal' && interaction.isModalSubmit()) {
          const [roleId, messageId] = data;
          if (!roleId) return R.error('Select a role first.');

          const input = interaction.fields.getTextInputValue('icon').trim();
          if (!input) return R.error('Please provide an icon input.');

          return {
            type: 'ASYNC_RESULT',
            execute: async (): Promise<InteractionResult> => {
              const role = interaction.guild.roles.cache.get(roleId);
              if (!role || !role.editable) {
                return { type: 'ERROR', message: 'This role can no longer be edited.' };
              }

              try {
                if (!input.startsWith('http')) {
                  return { type: 'ERROR', message: 'Invalid input. Provide an image URL starting with http.' };
                }
                const res = await fetch(input);
                if (!res.ok) return { type: 'ERROR', message: 'Failed to fetch image from URL.' };
                const mime = res.headers.get('content-type') || 'image/png';
                if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime!)) {
                  return { type: 'ERROR', message: 'Unsupported image format. Use PNG, JPEG, GIF, or WebP.' };
                }
                const buf = Buffer.from(await res.arrayBuffer());
                const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
                await role.setIcon(dataUri, `Icon changed by ${interaction.user.tag}`);
              } catch {
                return { type: 'ERROR', message: 'Failed to update role icon.' };
              }

              const container = buildResultContainer(
                `✅ <@&${roleId}> icon updated.`
              );

              try {
                const msg = await interaction.channel.messages.fetch(messageId);
                await msg.edit({ components: [container], allowedMentions: { roles: [] } });
              } catch {
                return { type: 'ERROR', message: 'Failed to update message.' };
              }

              await interaction.deleteReply().catch(() => {});
              return { type: 'IGNORE' };
            }
          };
        }

        if (action === 'confirm' && interaction.isButton()) {
          if (data.length < 2) return R.error('Select a role and set a color first.');

          const [roleId, hex, hex2, hex3] = data;
          if (!roleId || !hex) return R.error('Select a role and set a color first.');

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role || !role.editable) {
            return R.error('This role can no longer be edited.');
          }

          const botMember = interaction.guild.members.me;
          if (!botMember) return R.error('Bot not found in guild.');
          if (role.comparePositionTo(botMember.roles.highest) >= 0) {
            return R.error('This role is above my highest role.');
          }

          if (hex3) {
            if (!interaction.guild.features.includes('ENHANCED_ROLE_COLORS')) {
              return R.error('This server does not support gradient role colors.');
            }
            try {
              await role.setColors({
                primaryColor: 11127295,
                secondaryColor: 16759788,
                tertiaryColor: 16761760
              }, `Color changed by ${interaction.user.tag}`);
            } catch {
              return R.error('Failed to update role color.');
            }
            const container = buildResultContainer(
              `✅ <@&${roleId}> holographic style set to **#${hex.toUpperCase()} → #${hex2!.toUpperCase()} → #${hex3.toUpperCase()}**`
            );
            return {
              type: 'UPDATE',
              components: [container],
              allowedMentions: { roles: [] }
            } as InteractionResult;
          }

          if (hex2) {
            if (!interaction.guild.features.includes('ENHANCED_ROLE_COLORS')) {
              return R.error('This server does not support gradient role colors.');
            }
            try {
              await role.setColors({
                primaryColor: `#${hex}`,
                secondaryColor: `#${hex2}`
              }, `Color changed by ${interaction.user.tag}`);
            } catch {
              return R.error('Failed to update role color.');
            }
            const container = buildResultContainer(
              `✅ <@&${roleId}> gradient set to **#${hex.toUpperCase()} → #${hex2.toUpperCase()}**`
            );
            return {
              type: 'UPDATE',
              components: [container],
              allowedMentions: { roles: [] }
            } as InteractionResult;
          }

          const appliedHex = '#' + hex;
          try {
            await role.setColors({ primaryColor: appliedHex }, `Color changed by ${interaction.user.tag}`);
          } catch {
            return R.error('Failed to update role color.');
          }

          const colorName = hexToColorName(appliedHex);
          const container = buildResultContainer(
            `✅ <@&${roleId}> color set to **${appliedHex.toUpperCase()}** (${colorName})`
          );

          return {
            type: 'UPDATE',
            components: [container],
            allowedMentions: { roles: [] }
          } as InteractionResult;
        }

        if (action === 'cancel' && interaction.isButton()) {
          return {
            type: 'ASYNC_RESULT',
            execute: async (): Promise<InteractionResult> => {
              try {
                const msg = await interaction.channel.messages.fetch(interaction.message.id);
                await msg.delete();
              } catch {}
              return { type: 'IGNORE' };
            }
          };
        }

        return R.ignore();
      }
    },

    // ── Point At ──
    {
      name: 'interactionCreate',
      async execute(interaction: any): Promise<InteractionResult | undefined> {
        if (interaction.isChatInputCommand()) return undefined;
        if (!interaction.customId) return R.ignore();
        const parsed = parsePointCid(interaction.customId);
        if (!parsed) return R.ignore();

        const { action, userId, data } = parsed;

        if (action === 'submit' && interaction.isModalSubmit()) {
          if (interaction.user.id !== userId) {
            return R.error('This modal is not for you.');
          }

          const targetId = data[0];
          const message = interaction.fields.getTextInputValue('message').trim();
          if (!message) return R.error('Message cannot be empty.');

          const targetUser = targetId
            ? await interaction.client.users.fetch(targetId).catch(() => null)
            : null;

          if (!targetUser) return R.error('Target user not found.');

          return {
            type: 'ASYNC_RESULT',
            execute: async (): Promise<InteractionResult> => {
              let buffer: Buffer;
              try {
                buffer = await generatePointatImage(
                  targetUser.displayAvatarURL({ extension: 'png', size: 4096 }),
                  message
                );
              } catch (err) {
                console.error('Image generation failed:', err);
                return { type: 'ERROR', message: 'Failed to generate image.' };
              }

              const container = new ContainerBuilder()
                .addMediaGalleryComponents(
                  new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://pointat.png')
                  )
                );

              try {
                await interaction.editReply({
                  flags: MessageFlags.IsComponentsV2,
                  components: [container],
                  files: [{ attachment: buffer, name: 'pointat.png' }]
                });
              } catch (err) {
                console.error('Failed to send reply:', err);
                return { type: 'ERROR', message: 'Failed to send response.' };
              }

              return { type: 'IGNORE' };
            }
          };
        }

        return R.ignore();
      }
    }
  ]
} satisfies ModuleDefinition;
