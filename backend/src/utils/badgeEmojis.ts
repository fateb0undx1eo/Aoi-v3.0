import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../../data');
const BADGE_EMOJI_FILE = join(DATA_DIR, 'badge_emoji_mappings.json');
const BADGE_EMOJI_NAME_PREFIX = 'badge_';

const memoryCache = new Map<string, string>();

let loadPromise: Promise<Record<string, string>> | null = null;

async function loadBadgeMappings(): Promise<Record<string, string>> {
  try {
    const data = await readFile(BADGE_EMOJI_FILE, 'utf-8');
    const mappings = JSON.parse(data);
    for (const [url, id] of Object.entries<string>(mappings)) {
      memoryCache.set(url, id);
    }
    return mappings;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

async function saveBadgeMappings(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const obj = Object.fromEntries(memoryCache);
  await writeFile(BADGE_EMOJI_FILE, JSON.stringify(obj, null, 2), 'utf-8');
}

function loadMappingsSync(): Promise<Record<string, string>> {
  if (!loadPromise) {
    loadPromise = loadBadgeMappings().catch(() => ({}));
  }
  return loadPromise;
}

async function downloadBadgeImage(badgeUrl: string): Promise<Buffer | null> {
  const cleanUrl = badgeUrl.includes('?size=') ? badgeUrl.split('?size=')[0]! : badgeUrl;
  const response = await fetch(cleanUrl);
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

async function getOrCreateBadgeEmoji(client: any, badgeUrl: string): Promise<string | null> {
  try {
    const cleanUrl = badgeUrl.includes('?size=') ? badgeUrl.split('?size=')[0]! : badgeUrl;

    await loadMappingsSync();

    if (memoryCache.has(cleanUrl)) {
      return memoryCache.get(cleanUrl) ?? null;
    }

    if (!client.application) {
      return null;
    }

    const badgeHash = cleanUrl.split('/').pop()!.replace('.png', '');
    const emojiName = `${BADGE_EMOJI_NAME_PREFIX}${badgeHash.slice(0, 8)}`;

    const existing = client.application.emojis.cache.find((e: any) => e.name === emojiName);
    if (existing) {
      memoryCache.set(cleanUrl, existing.id);
      await saveBadgeMappings();
      return existing.id;
    }

    const imageData = await downloadBadgeImage(cleanUrl);
    if (!imageData) return null;

    try {
      const emoji = await client.application.emojis.create({
        name: emojiName,
        attachment: imageData
      });
      memoryCache.set(cleanUrl, emoji.id);
      await saveBadgeMappings();
      return emoji.id;
    } catch (err: any) {
      if (err.code === 30063) {
        const refreshed = client.application.emojis.cache.find((e: any) => e.name === emojiName);
        if (refreshed) {
          memoryCache.set(cleanUrl, refreshed.id);
          await saveBadgeMappings();
          return refreshed.id;
        }
      }
      return null;
    }
  } catch {
    return null;
  }
}

export { getOrCreateBadgeEmoji };
