import { AttachmentBuilder } from 'discord.js';

const LEVELING_SCHEMA = {
  type: 'object',
  properties: {
    rank_card: {
      type: 'object',
      properties: {
        background_color: { type: 'string' },
        panel_color: { type: 'string' },
        panel_border_color: { type: 'string' },
        display_name_color: { type: 'string' },
        username_color: { type: 'string' },
        rank_color: { type: 'string' },
        rank_label_color: { type: 'string' },
        progress_track_color: { type: 'string' },
        progress_start_color: { type: 'string' },
        progress_end_color: { type: 'string' },
        progress_text_color: { type: 'string' },
        stat_card_color: { type: 'string' },
        stat_label_color: { type: 'string' },
        stat_value_color: { type: 'string' },
        status_color: { type: 'string' },
        grid_color: { type: 'string' }
      }
    }
  }
};

const DEFAULT_RANK_CARD_CONFIG = Object.freeze({
  background_color: '#090A10',
  panel_color: '#181920',
  panel_border_color: '#282A33',
  display_name_color: '#FFFFFF',
  username_color: '#858B9A',
  rank_color: '#FFFFFF',
  rank_label_color: '#D62BFF',
  progress_track_color: '#1A1B23',
  progress_start_color: '#A414F5',
  progress_end_color: '#E363E9',
  progress_text_color: '#E9ECF5',
  stat_card_color: '#191A21',
  stat_label_color: '#878C9A',
  stat_value_color: '#FFFFFF',
  status_color: '#28D56C',
  grid_color: '#20222B'
});

function cleanHex(value, fallback) {
  const text = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toUpperCase() : fallback;
}

function getRankCardConfig(configCache, guildId) {
  const cached = configCache?.getModuleConfig?.(guildId, 'leveling');
  const rankCard = cached?.config?.rank_card ?? {};

  return Object.fromEntries(
    Object.entries(DEFAULT_RANK_CARD_CONFIG).map(([key, fallback]) => [
      key,
      cleanHex(rankCard[key], fallback)
    ])
  );
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function compactNumber(value) {
  if (value >= 1000) {
    const compact = value / 1000;
    return `${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)}K`;
  }
  return String(value);
}

function getDeterministicStats(userId) {
  const digits = String(userId ?? '').replace(/\D/g, '');
  const seed = Number.parseInt(digits.slice(-6) || '421337', 10);
  const current = 2600 + (seed % 1800);
  const needed = 5000;
  const daily = 800 + (seed % 4200);
  const lifetime = 24000 + (seed % 92000);
  const rank = 1 + (seed % 99);

  return {
    rank,
    current,
    needed,
    remaining: Math.max(needed - current, 0),
    daily,
    lifetime,
    progress: Math.min(current / needed, 1)
  };
}

async function avatarDataUri(user) {
  const url = user.displayAvatarURL({ extension: 'png', size: 256 });
  const response = await fetch(url);
  if (!response.ok) return url;
  const contentType = response.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

function buildRankCardSvg({ user, avatarUri, config, stats }) {
  const width = 1000;
  const height = 350;
  const progressWidth = Math.round(660 * stats.progress);
  const displayName = escapeXml(user.globalName || user.displayName || user.username);
  const username = escapeXml(user.username);
  const safeAvatarUri = escapeXml(avatarUri);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="${config.grid_color}" stroke-width="1" opacity="0.7"/>
    </pattern>
    <linearGradient id="progress" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${config.progress_start_color}"/>
      <stop offset="100%" stop-color="${config.progress_end_color}"/>
    </linearGradient>
    <clipPath id="avatarClip">
      <circle cx="150" cy="132" r="70"/>
    </clipPath>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.42"/>
    </filter>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${config.background_color}"/>
  <rect width="${width}" height="${height}" fill="url(#grid)" opacity="0.7"/>
  <circle cx="890" cy="176" r="170" fill="${config.progress_start_color}" opacity="0.11"/>

  <g filter="url(#softShadow)">
    <rect x="35" y="30" width="230" height="290" rx="24" fill="${config.panel_color}" stroke="${config.panel_border_color}"/>
    <circle cx="150" cy="132" r="74" fill="none" stroke="url(#progress)" stroke-width="8" filter="url(#glow)"/>
    <image href="${safeAvatarUri}" x="80" y="62" width="140" height="140" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
    <text x="150" y="268" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="900" fill="${config.rank_color}">#${stats.rank}</text>
    <text x="150" y="294" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="4" fill="${config.rank_label_color}">GLOBAL RANK</text>
    <rect x="83" y="309" width="134" height="34" rx="17" fill="${config.status_color}" opacity="0.14" stroke="${config.status_color}" stroke-width="1"/>
    <text x="150" y="331" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="${config.status_color}">SUPER ACTIVE</text>
  </g>

  <text x="305" y="72" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900" fill="${config.display_name_color}">${displayName}</text>
  <text x="307" y="100" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="${config.username_color}">@${username}</text>
  <text x="305" y="116" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" letter-spacing="1" fill="${config.stat_label_color}">WEEKLY PROGRESS</text>
  <text x="965" y="117" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="900" fill="${config.progress_text_color}">${compactNumber(stats.current)} / ${compactNumber(stats.needed)}</text>
  <rect x="305" y="128" width="660" height="30" rx="15" fill="${config.progress_track_color}"/>
  <rect x="305" y="128" width="${progressWidth}" height="30" rx="15" fill="url(#progress)"/>
  <text x="305" y="181" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="600" fill="${config.username_color}">${compactNumber(stats.remaining)} more XP for next role</text>

  <g filter="url(#softShadow)">
    <rect x="305" y="204" width="220" height="94" rx="13" fill="${config.stat_card_color}" stroke="${config.panel_border_color}"/>
    <rect x="350" y="204" width="130" height="2" fill="url(#progress)"/>
    <text x="323" y="234" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="800" fill="${config.stat_label_color}">DAILY XP</text>
    <text x="323" y="272" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900" fill="${config.stat_value_color}">${compactNumber(stats.daily)}</text>
    <text x="323" y="293" font-family="Inter, Arial, sans-serif" font-size="13" fill="${config.username_color}">${stats.daily.toLocaleString()}</text>

    <rect x="543" y="204" width="220" height="94" rx="13" fill="${config.stat_card_color}" stroke="${config.panel_border_color}"/>
    <rect x="588" y="204" width="130" height="2" fill="url(#progress)"/>
    <text x="561" y="234" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="800" fill="${config.stat_label_color}">LIFETIME</text>
    <text x="561" y="272" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900" fill="${config.stat_value_color}">${compactNumber(stats.lifetime)}</text>
    <text x="561" y="293" font-family="Inter, Arial, sans-serif" font-size="13" fill="${config.username_color}">${stats.lifetime.toLocaleString()}</text>
  </g>
</svg>`;
}

async function buildRankAttachment(user, config) {
  const stats = getDeterministicStats(user.id);
  const avatarUri = await avatarDataUri(user).catch(() => user.displayAvatarURL({ extension: 'png', size: 256 }));
  const svg = buildRankCardSvg({ user, avatarUri, config, stats });
  return new AttachmentBuilder(Buffer.from(svg), { name: `rank-${user.id}.svg` });
}

export default {
  name: 'leveling',
  configSchema: LEVELING_SCHEMA,
  commands: [
    {
      name: 'rank',
      description: 'Show your rank card',
      async execute(interaction, { configCache }) {
        const config = getRankCardConfig(configCache, interaction.guildId);
        const attachment = await buildRankAttachment(interaction.user, config);
        await interaction.editReply({ files: [attachment] });
      }
    }
  ],
  events: []
};
