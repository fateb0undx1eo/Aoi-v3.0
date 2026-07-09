import type { UrlMap, AttachmentUri } from './types.js';

function replaceInComponents(components: any[], urlMap: UrlMap): void {
  for (const comp of components) {
    if (!comp || typeof comp.type === 'undefined') continue;

    if ((comp.type === 11 || comp.type === 12 || comp.type === 13) && comp.items) {
      for (const item of comp.items) {
        if (item.media?.url && urlMap.has(item.media.url as AttachmentUri)) {
          item.media.url = urlMap.get(item.media.url as AttachmentUri)!;
        }
      }
    }

    if (comp.type === 13 && comp.file?.url && urlMap.has(comp.file.url as AttachmentUri)) {
      comp.file.url = urlMap.get(comp.file.url as AttachmentUri)!;
    }

    if (comp.type === 9) {
      if (comp.components) replaceInComponents(comp.components, urlMap);
      if (comp.accessory?.type === 11 && comp.accessory.items) {
        for (const item of comp.accessory.items) {
          if (item.media?.url && urlMap.has(item.media.url as AttachmentUri)) {
            item.media.url = urlMap.get(item.media.url as AttachmentUri)!;
          }
        }
      }
      if (comp.accessory?.type === 2 && comp.accessory.emoji?.id && comp.accessory.emoji?.animated != null) {
        const emojiUrl = `https://cdn.discordapp.com/emojis/${comp.accessory.emoji.id}.${comp.accessory.emoji.animated ? 'gif' : 'webp'}`;
        if (urlMap.has(emojiUrl as AttachmentUri)) {
          comp.accessory.emoji.id = urlMap.get(emojiUrl as AttachmentUri)!.replace(/^https:\/\/cdn\.discordapp\.com\/emojis\//, '').replace(/\.(webp|gif|png)$/, '') || comp.accessory.emoji.id;
        }
      }
    }

    if (comp.type === 2 && comp.emoji?.id && comp.emoji?.animated != null) {
      const emojiUrl = `https://cdn.discordapp.com/emojis/${comp.emoji.id}.${comp.emoji.animated ? 'gif' : 'webp'}`;
      if (urlMap.has(emojiUrl as AttachmentUri)) {
        comp.emoji.id = urlMap.get(emojiUrl as AttachmentUri)!.replace(/^https:\/\/cdn\.discordapp\.com\/emojis\//, '').replace(/\.(webp|gif|png)$/, '') || comp.emoji.id;
      }
    }

    if (comp.type === 17 && comp.components) {
      replaceInComponents(comp.components, urlMap);
    }
  }
}

export function replaceAttachmentUris(entries: any[], urlMap: UrlMap): void {
  for (const entry of entries) {
    const rawComponents = (entry as any)._rawComponents as any[] | undefined;
    if (rawComponents && rawComponents.length > 0) {
      replaceInComponents(rawComponents, urlMap);
    }

    for (const embed of (entry.embeds || [])) {
      if (embed.image_url && urlMap.has(embed.image_url as AttachmentUri)) {
        embed.image_url = urlMap.get(embed.image_url as AttachmentUri)!;
      }
      if (embed.thumbnail_url && urlMap.has(embed.thumbnail_url as AttachmentUri)) {
        embed.thumbnail_url = urlMap.get(embed.thumbnail_url as AttachmentUri)!;
      }
      if (embed.author_icon_url && urlMap.has(embed.author_icon_url as AttachmentUri)) {
        embed.author_icon_url = urlMap.get(embed.author_icon_url as AttachmentUri)!;
      }
      if (embed.footer_icon_url && urlMap.has(embed.footer_icon_url as AttachmentUri)) {
        embed.footer_icon_url = urlMap.get(embed.footer_icon_url as AttachmentUri)!;
      }
    }
  }
}
