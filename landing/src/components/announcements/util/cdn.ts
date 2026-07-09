export const cdn = {
  emoji: (id: string, format: "gif" | "webp" | "png" = "webp") =>
    `https://cdn.discordapp.com/emojis/${id}.${format}`,
  roleIcon: (roleId: string, icon: string, options?: { size?: number }) =>
    `https://cdn.discordapp.com/role-icons/${roleId}/${icon}.${options?.size ? `png?size=${options.size}` : "webp"}`,
};

export function cdnImgAttributes(
  size: number,
  urlFn: (size: number) => string,
): { src: string; srcSet: string } {
  return {
    src: urlFn(size),
    srcSet: `${urlFn(size * 2)} 2x`,
  };
}
