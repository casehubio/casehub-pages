export interface PagesTheme {
  readonly font: string;
  readonly fontSize: string;
  readonly text: string;
  readonly textMuted: string;
  readonly bg: string;
  readonly bgAlt: string;
  readonly bgHover: string;
  readonly bgDisabled: string;
  readonly border: string;
  readonly radius: string;
  readonly accent: string;
  readonly accentHover: string;
  readonly accentSubtle: string;
}

export const LIGHT_THEME: PagesTheme = {
  font: "system-ui, sans-serif",
  fontSize: "14px",
  text: "#333",
  textMuted: "#888",
  bg: "#fff",
  bgAlt: "#f0f0f0",
  bgHover: "#e8f0fe",
  bgDisabled: "#f5f5f5",
  border: "#e0e0e0",
  radius: "4px",
  accent: "#5470c6",
  accentHover: "#4361b0",
  accentSubtle: "#e8eaf6",
};

export const DARK_THEME: PagesTheme = {
  font: "system-ui, sans-serif",
  fontSize: "14px",
  text: "#e0e0e0",
  textMuted: "#999",
  bg: "#1a1a2e",
  bgAlt: "#16213e",
  bgHover: "#1e3a5f",
  bgDisabled: "#2a2a3e",
  border: "#3a3a5e",
  radius: "4px",
  accent: "#7c8cf8",
  accentHover: "#6366f1",
  accentSubtle: "#2d2b55",
};

const TOKEN_MAP: ReadonlyArray<readonly [keyof PagesTheme, string]> = [
  ["font", "--pages-font"],
  ["fontSize", "--pages-font-size"],
  ["text", "--pages-text"],
  ["textMuted", "--pages-text-muted"],
  ["bg", "--pages-bg"],
  ["bgAlt", "--pages-bg-alt"],
  ["bgHover", "--pages-bg-hover"],
  ["bgDisabled", "--pages-bg-disabled"],
  ["border", "--pages-border"],
  ["radius", "--pages-radius"],
  ["accent", "--pages-accent"],
  ["accentHover", "--pages-accent-hover"],
  ["accentSubtle", "--pages-accent-subtle"],
];

function resolveTheme(theme: PagesTheme | "light" | "dark"): PagesTheme {
  if (theme === "light") return LIGHT_THEME;
  if (theme === "dark") return DARK_THEME;
  return theme;
}

function resolveThemeName(theme: PagesTheme): string {
  if (theme === LIGHT_THEME) return "light";
  if (theme === DARK_THEME) return "dark";
  return "custom";
}

export function applyTheme(
  element: HTMLElement,
  theme: PagesTheme | "light" | "dark",
): void {
  const resolved = resolveTheme(theme);
  for (const [key, prop] of TOKEN_MAP) {
    element.style.setProperty(prop, resolved[key]);
  }
  element.dataset.pagesTheme = resolveThemeName(resolved);
}

export function clearTheme(element: HTMLElement): void {
  for (const [, prop] of TOKEN_MAP) {
    element.style.removeProperty(prop);
  }
  delete element.dataset.pagesTheme;
}
