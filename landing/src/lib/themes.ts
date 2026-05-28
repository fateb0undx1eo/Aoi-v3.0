export const appThemes = ["light", "dark", "atomic"] as const;

export type AppTheme = (typeof appThemes)[number];

const themeLabels: Record<AppTheme, string> = {
  light: "Light",
  dark: "Dark",
  atomic: "Atomic",
};

export function getActiveTheme(theme?: string, resolvedTheme?: string): AppTheme {
  if (theme === "atomic") {
    return "atomic";
  }

  return resolvedTheme === "dark" || theme === "dark" ? "dark" : "light";
}

export function getNextTheme(theme: AppTheme): AppTheme {
  const index = appThemes.indexOf(theme);
  return appThemes[(index + 1) % appThemes.length];
}

export function getThemeLabel(theme: AppTheme) {
  return themeLabels[theme];
}
