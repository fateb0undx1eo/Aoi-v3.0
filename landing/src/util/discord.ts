export const cdn = {
  emoji: (id: string, format: "webp" | "gif") =>
    `https://cdn.discordapp.com/emojis/${id}.${format}?size=48`,
};
