export const appThemes = ["light", "dark"] as const;

export type AppTheme = (typeof appThemes)[number];

const themeLabels: Record<AppTheme, string> = {
  light: "Light",
  dark: "Dark",
};

export function getActiveTheme(theme?: string, resolvedTheme?: string): AppTheme {
  return resolvedTheme === "dark" || theme === "dark" ? "dark" : "light";
}

export function getNextTheme(theme: AppTheme): AppTheme {
  return theme === "light" ? "dark" : "light";
}

export function getThemeLabel(theme: AppTheme) {
  return themeLabels[theme];
}
