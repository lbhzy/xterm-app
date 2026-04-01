import { invoke } from "@tauri-apps/api/core";

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  fontFamilySecondary?: string;
  cursorBlink: boolean;
  cursorStyle: "block" | "underline" | "bar";
  themeName: string;
  customTheme?: TerminalTheme;
  appTheme: string;
}

const CONFIG_KEY = "terminal-settings";

export const APP_THEMES: { id: string; name: string; dark: boolean }[] = [
  { id: "dark-blue", name: "Dark Blue", dark: true },
  { id: "dark-pure", name: "Dark Pure", dark: true },
  { id: "dark-green", name: "Dark Green", dark: true },
  { id: "dark-purple", name: "Dark Purple", dark: true },
  { id: "dark-warm", name: "Dark Warm", dark: true },
  { id: "light", name: "Light", dark: false },
  { id: "light-warm", name: "Light Warm", dark: false },
  { id: "light-green", name: "Light Green", dark: false },
  { id: "light-rose", name: "Light Rosé", dark: false },
];

export const BUILTIN_THEMES: Record<string, TerminalTheme> = {
  // ── Dark Themes ──
  "Dark (Default)": {
    background: "#0a0a0a",
    foreground: "#fafafa",
    cursor: "#fafafa",
    selectionBackground: "#3f3f46",
    black: "#18181b",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#eab308",
    blue: "#3b82f6",
    magenta: "#a855f7",
    cyan: "#06b6d4",
    white: "#fafafa",
    brightBlack: "#52525b",
    brightRed: "#f87171",
    brightGreen: "#4ade80",
    brightYellow: "#facc15",
    brightBlue: "#60a5fa",
    brightMagenta: "#c084fc",
    brightCyan: "#22d3ee",
    brightWhite: "#ffffff",
  },
  "Solarized Dark": {
    background: "#002b36",
    foreground: "#839496",
    cursor: "#839496",
    selectionBackground: "#073642",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#586e75",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
  "Monokai": {
    background: "#272822",
    foreground: "#f8f8f2",
    cursor: "#f8f8f0",
    selectionBackground: "#49483e",
    black: "#272822",
    red: "#f92672",
    green: "#a6e22e",
    yellow: "#f4bf75",
    blue: "#66d9ef",
    magenta: "#ae81ff",
    cyan: "#a1efe4",
    white: "#f8f8f2",
    brightBlack: "#75715e",
    brightRed: "#f92672",
    brightGreen: "#a6e22e",
    brightYellow: "#f4bf75",
    brightBlue: "#66d9ef",
    brightMagenta: "#ae81ff",
    brightCyan: "#a1efe4",
    brightWhite: "#f9f8f5",
  },
  "Dracula": {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    selectionBackground: "#44475a",
    black: "#21222c",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#bd93f9",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#f8f8f2",
    brightBlack: "#6272a4",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff",
  },
  "Nord": {
    background: "#2e3440",
    foreground: "#d8dee9",
    cursor: "#d8dee9",
    selectionBackground: "#434c5e",
    black: "#3b4252",
    red: "#bf616a",
    green: "#a3be8c",
    yellow: "#ebcb8b",
    blue: "#81a1c1",
    magenta: "#b48ead",
    cyan: "#88c0d0",
    white: "#e5e9f0",
    brightBlack: "#4c566a",
    brightRed: "#bf616a",
    brightGreen: "#a3be8c",
    brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1",
    brightMagenta: "#b48ead",
    brightCyan: "#8fbcbb",
    brightWhite: "#eceff4",
  },
  "One Dark": {
    background: "#282c34",
    foreground: "#abb2bf",
    cursor: "#528bff",
    selectionBackground: "#3e4451",
    black: "#282c34",
    red: "#e06c75",
    green: "#98c379",
    yellow: "#e5c07b",
    blue: "#61afef",
    magenta: "#c678dd",
    cyan: "#56b6c2",
    white: "#abb2bf",
    brightBlack: "#5c6370",
    brightRed: "#e06c75",
    brightGreen: "#98c379",
    brightYellow: "#e5c07b",
    brightBlue: "#61afef",
    brightMagenta: "#c678dd",
    brightCyan: "#56b6c2",
    brightWhite: "#ffffff",
  },
  "Tokyo Night": {
    background: "#1a1b26",
    foreground: "#c0caf5",
    cursor: "#c0caf5",
    selectionBackground: "#33467c",
    black: "#15161e",
    red: "#f7768e",
    green: "#9ece6a",
    yellow: "#e0af68",
    blue: "#7aa2f7",
    magenta: "#bb9af7",
    cyan: "#7dcfff",
    white: "#a9b1d6",
    brightBlack: "#414868",
    brightRed: "#f7768e",
    brightGreen: "#9ece6a",
    brightYellow: "#e0af68",
    brightBlue: "#7aa2f7",
    brightMagenta: "#bb9af7",
    brightCyan: "#7dcfff",
    brightWhite: "#c0caf5",
  },
  "Catppuccin Mocha": {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    selectionBackground: "#45475a",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#f5c2e7",
    cyan: "#94e2d5",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#f5c2e7",
    brightCyan: "#94e2d5",
    brightWhite: "#a6adc8",
  },
  "Gruvbox Dark": {
    background: "#282828",
    foreground: "#ebdbb2",
    cursor: "#ebdbb2",
    selectionBackground: "#504945",
    black: "#282828",
    red: "#cc241d",
    green: "#98971a",
    yellow: "#d79921",
    blue: "#458588",
    magenta: "#b16286",
    cyan: "#689d6a",
    white: "#a89984",
    brightBlack: "#928374",
    brightRed: "#fb4934",
    brightGreen: "#b8bb26",
    brightYellow: "#fabd2f",
    brightBlue: "#83a598",
    brightMagenta: "#d3869b",
    brightCyan: "#8ec07c",
    brightWhite: "#ebdbb2",
  },
  "GitHub Dark": {
    background: "#0d1117",
    foreground: "#e6edf3",
    cursor: "#e6edf3",
    selectionBackground: "#264f78",
    black: "#0d1117",
    red: "#ff7b72",
    green: "#3fb950",
    yellow: "#d29922",
    blue: "#58a6ff",
    magenta: "#bc8cff",
    cyan: "#39c5cf",
    white: "#b1bac4",
    brightBlack: "#6e7681",
    brightRed: "#ffa198",
    brightGreen: "#56d364",
    brightYellow: "#e3b341",
    brightBlue: "#79c0ff",
    brightMagenta: "#d2a8ff",
    brightCyan: "#56d4dd",
    brightWhite: "#f0f6fc",
  },

  // ── Light Themes ──
  "Solarized Light": {
    background: "#fdf6e3",
    foreground: "#657b83",
    cursor: "#586e75",
    selectionBackground: "#eee8d5",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#002b36",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
  "GitHub Light": {
    background: "#ffffff",
    foreground: "#1f2328",
    cursor: "#1f2328",
    selectionBackground: "#add6ff",
    black: "#24292f",
    red: "#cf222e",
    green: "#116329",
    yellow: "#4d2d00",
    blue: "#0969da",
    magenta: "#8250df",
    cyan: "#1b7c83",
    white: "#6e7781",
    brightBlack: "#57606a",
    brightRed: "#a40e26",
    brightGreen: "#1a7f37",
    brightYellow: "#633c01",
    brightBlue: "#218bff",
    brightMagenta: "#a475f9",
    brightCyan: "#3192aa",
    brightWhite: "#8c959f",
  },
  "One Light": {
    background: "#fafafa",
    foreground: "#383a42",
    cursor: "#526eff",
    selectionBackground: "#e5e5e6",
    black: "#383a42",
    red: "#e45649",
    green: "#50a14f",
    yellow: "#c18401",
    blue: "#4078f2",
    magenta: "#a626a4",
    cyan: "#0184bc",
    white: "#a0a1a7",
    brightBlack: "#4f525e",
    brightRed: "#e06c75",
    brightGreen: "#98c379",
    brightYellow: "#e5c07b",
    brightBlue: "#61afef",
    brightMagenta: "#c678dd",
    brightCyan: "#56b6c2",
    brightWhite: "#ffffff",
  },
  "Catppuccin Latte": {
    background: "#eff1f5",
    foreground: "#4c4f69",
    cursor: "#dc8a78",
    selectionBackground: "#ccd0da",
    black: "#5c5f77",
    red: "#d20f39",
    green: "#40a02b",
    yellow: "#df8e1d",
    blue: "#1e66f5",
    magenta: "#ea76cb",
    cyan: "#179299",
    white: "#acb0be",
    brightBlack: "#6c6f85",
    brightRed: "#d20f39",
    brightGreen: "#40a02b",
    brightYellow: "#df8e1d",
    brightBlue: "#1e66f5",
    brightMagenta: "#ea76cb",
    brightCyan: "#179299",
    brightWhite: "#bcc0cc",
  },
  "Gruvbox Light": {
    background: "#fbf1c7",
    foreground: "#3c3836",
    cursor: "#3c3836",
    selectionBackground: "#d5c4a1",
    black: "#3c3836",
    red: "#cc241d",
    green: "#98971a",
    yellow: "#d79921",
    blue: "#458588",
    magenta: "#b16286",
    cyan: "#689d6a",
    white: "#7c6f64",
    brightBlack: "#928374",
    brightRed: "#9d0006",
    brightGreen: "#79740e",
    brightYellow: "#b57614",
    brightBlue: "#076678",
    brightMagenta: "#8f3f71",
    brightCyan: "#427b58",
    brightWhite: "#3c3836",
  },
  "Rosé Pine Dawn": {
    background: "#faf4ed",
    foreground: "#575279",
    cursor: "#575279",
    selectionBackground: "#dfdad9",
    black: "#575279",
    red: "#b4637a",
    green: "#286983",
    yellow: "#ea9d34",
    blue: "#56949f",
    magenta: "#907aa9",
    cyan: "#d7827e",
    white: "#9893a5",
    brightBlack: "#797593",
    brightRed: "#b4637a",
    brightGreen: "#286983",
    brightYellow: "#ea9d34",
    brightBlue: "#56949f",
    brightMagenta: "#907aa9",
    brightCyan: "#d7827e",
    brightWhite: "#cecacd",
  },
};

const DEFAULT_SETTINGS: TerminalSettings = {
  fontSize: 14,
  fontFamily: "Cascadia Mono",
  fontFamilySecondary: "",
  cursorBlink: true,
  cursorStyle: "block",
  themeName: "GitHub Light",
  appTheme: "light",
};

function stripQuotes(name: string): string {
  return name.trim().replace(/^['"]|['"]$/g, "");
}

function splitFontStack(stack: string): string[] {
  return stack
    .split(",")
    .map((part) => stripQuotes(part))
    .filter((part) => {
      const lower = part.toLowerCase();
      return lower !== "monospace" && lower !== "serif" && lower !== "sans-serif";
    });
}

function quoteFont(name: string): string {
  return `"${name.replace(/"/g, "\\\"")}"`;
}

export function getResolvedFontFamily(settings: TerminalSettings): string {
  const primary = stripQuotes(settings.fontFamily || DEFAULT_SETTINGS.fontFamily);
  const secondary = stripQuotes(settings.fontFamilySecondary || "");

  const familyParts = [quoteFont(primary)];
  if (secondary) familyParts.push(quoteFont(secondary));
  familyParts.push("monospace");
  return familyParts.join(", ");
}

export async function loadTerminalSettings(): Promise<TerminalSettings> {
  try {
    const data = await invoke<TerminalSettings | null>("config_read", { key: CONFIG_KEY });
    if (data) {
      const merged = { ...DEFAULT_SETTINGS, ...data };

      // Migrate old font stack format into primary + secondary fields.
      const parsed = splitFontStack(merged.fontFamily || DEFAULT_SETTINGS.fontFamily);
      const primary = parsed[0] || DEFAULT_SETTINGS.fontFamily;
      const secondary = merged.fontFamilySecondary || parsed[1] || "";

      return {
        ...merged,
        fontFamily: primary,
        fontFamilySecondary: secondary,
      };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveTerminalSettings(settings: TerminalSettings) {
  await invoke("config_write", { key: CONFIG_KEY, value: settings });
}

export function getTheme(settings: TerminalSettings): TerminalTheme {
  if (settings.themeName === "Custom" && settings.customTheme) {
    return settings.customTheme;
  }
  return BUILTIN_THEMES[settings.themeName] ?? BUILTIN_THEMES["Dark (Default)"];
}
