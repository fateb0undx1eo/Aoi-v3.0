import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/&#183;/g, '·')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');
}

function metaContent(html: string, property: string): string | null {
  const match = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'));
  return match ? decodeEntities(match[1] ?? '') : null;
}

/**
 * Public track-metadata proxy (no auth). Resolves Spotify / YouTube track data
 * so the studio can show a song name + cover + artist without exposing keys or
 * hitting CORS in the browser.
 *
 * Spotify: scrapes the track page's Open Graph tags (which include the artist +
 * album in `og:description`), exactly like Discord does — no Web API / Premium needed.
 * YouTube: uses oEmbed and infers the artist from "Artist - Title" when present.
 */
export async function oembedRoutes(instance: FastifyInstance): Promise<void> {
  instance.get('/oembed', {}, async (request: FastifyRequest, reply: FastifyReply) => {
    const url = String((request.query as Record<string, string>).url ?? '').trim();
    if (!url) return reply.status(400).send({ error: 'Missing url' });
    try {
      const isSpotify = /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/i.test(url);

      if (isSpotify) {
        try {
          const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const title = metaContent(html, 'og:title');
            const description = metaContent(html, 'og:description');
            const thumbnail = metaContent(html, 'og:image');
            if (title || thumbnail) {
              const parts = (description ?? '').split('·').map((p) => p.trim()).filter(Boolean);
              const artist = parts[0] ?? null;
              const album = parts.length > 1 ? (parts[1] ?? null) : null;
              return reply.status(200).send({
                ok: true,
                title: (title ?? '').slice(0, 80),
                thumbnail_url: thumbnail ?? null,
                artist,
                album,
                provider_name: 'Spotify',
              });
            }
          }
        } catch {
          /* fall through to oembed */
        }
        // Fallback to oEmbed if the page scrape failed.
        const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) return reply.status(502).send({ error: 'Could not fetch track info' });
        const data = (await res.json()) as Record<string, any>;
        return reply.status(200).send({
          ok: true,
          title: String(data?.title ?? '').slice(0, 80),
          thumbnail_url: typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : null,
          artist: null,
          album: null,
          provider_name: 'Spotify',
        });
      }

      // YouTube
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) return reply.status(502).send({ error: 'Could not fetch track info' });
      const data = (await res.json()) as Record<string, any>;
      const title = String(data?.title ?? '');
      const dash = title.split(' - ');
      const artist = dash.length > 1 ? (dash[0]?.trim() ?? null) : null;
      const songTitle = dash.length > 1 ? dash.slice(1).join(' - ').trim() : title;
      return reply.status(200).send({
        ok: true,
        title: songTitle.slice(0, 80),
        thumbnail_url: typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : null,
        artist,
        album: null,
        provider_name: 'YouTube',
      });
    } catch (error: any) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : 'Track fetch failed' });
    }
  });
}
