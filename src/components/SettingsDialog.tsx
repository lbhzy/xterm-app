import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FolderOpen } from "lucide-react";
import {
  type TerminalSettings,
  type TerminalTheme,
  BUILTIN_THEMES,
  APP_THEMES,
  getTheme,
} from "@/lib/terminal-settings";

interface SettingsDialogProps {
  open: boolean;
  settings: TerminalSettings;
  onSave: (settings: TerminalSettings) => void;
  onCancel: () => void;
}

interface SystemFontGroups {
  all: string[];
  monospace: string[];
  chinese: string[];
}

function normalizeFontName(fontName: string): string {
  return fontName.trim().replace(/^['"]|['"]$/g, "");
}

function withCurrent(list: string[], current: string): string[] {
  if (!current) return list;
  return list.includes(current) ? list : [current, ...list];
}

function isLightTheme(theme: TerminalTheme): boolean {
  // Parse hex to luminance — light backgrounds have high luminance
  const hex = theme.background.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 128;
}

const darkThemes = Object.keys(BUILTIN_THEMES).filter((n) => !isLightTheme(BUILTIN_THEMES[n]));
const lightThemes = Object.keys(BUILTIN_THEMES).filter((n) => isLightTheme(BUILTIN_THEMES[n]));

export function SettingsDialog({
  open,
  settings: initial,
  onSave,
  onCancel,
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<TerminalSettings>(initial);
  const [monoFonts, setMonoFonts] = useState<string[]>([]);
  const [chineseFonts, setChineseFonts] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSettings(initial);
      invoke<SystemFontGroups>("system_list_fonts")
        .then((fonts) => {
          const normalizedMono = Array.from(
            new Set(fonts.monospace.map((font) => normalizeFontName(font)).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b));

          const normalizedChinese = Array.from(
            new Set(fonts.chinese.map((font) => normalizeFontName(font)).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b));

          const currentPrimary = normalizeFontName(initial.fontFamily || "");
          const currentChinese = normalizeFontName(initial.fontFamilySecondary || "");

          setMonoFonts(withCurrent(normalizedMono, currentPrimary));
          setChineseFonts(withCurrent(normalizedChinese, currentChinese));
        })
        .catch(() => {
          const currentPrimary = normalizeFontName(initial.fontFamily || "");
          const currentChinese = normalizeFontName(initial.fontFamilySecondary || "");
          setMonoFonts(currentPrimary ? [currentPrimary] : []);
          setChineseFonts(currentChinese ? [currentChinese] : []);
        });
    }
  }, [open, initial]);

  const theme = getTheme(settings);

  const update = (patch: Partial<TerminalSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Terminal Settings</DialogTitle>
          <DialogDescription>
            Configure terminal appearance and behavior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* App Theme */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">App Theme</Label>
            <Select
              value={settings.appTheme}
              onChange={(e) => update({ appTheme: e.target.value })}
            >
              <optgroup label="Dark">
                {APP_THEMES.filter((t) => t.dark).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              <optgroup label="Light">
                {APP_THEMES.filter((t) => !t.dark).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            </Select>
          </div>

          {/* Terminal Theme */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Terminal Color Theme</Label>
            <Select
              value={settings.themeName}
              onChange={(e) => update({ themeName: e.target.value })}
            >
              <optgroup label="Dark">
                {darkThemes.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </optgroup>
              <optgroup label="Light">
                {lightThemes.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </optgroup>
            </Select>
            {/* Theme preview */}
            <div
              className="rounded-md border border-border p-3 font-mono text-xs leading-relaxed"
              style={{ background: theme.background, color: theme.foreground }}
            >
              <div>
                <span style={{ color: theme.green }}>user@host</span>
                <span style={{ color: theme.foreground }}>:</span>
                <span style={{ color: theme.blue }}>~/project</span>
                <span style={{ color: theme.foreground }}>$ </span>
                <span style={{ color: theme.yellow }}>echo</span>
                <span style={{ color: theme.foreground }}> </span>
                <span style={{ color: theme.red }}>"Hello World"</span>
              </div>
              <div style={{ color: theme.foreground }}>Hello World</div>
              <div>
                <span style={{ color: theme.cyan }}>➜</span>
                <span style={{ color: theme.magenta }}> npm </span>
                <span style={{ color: theme.foreground }}>run build</span>
              </div>
            </div>
          </div>

          {/* Font */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Monospace Font</Label>
              <Select
                value={normalizeFontName(settings.fontFamily)}
                onChange={(e) => update({ fontFamily: normalizeFontName(e.target.value) })}
              >
                {monoFonts.length === 0 && (
                  <option value={normalizeFontName(settings.fontFamily)}>
                    {normalizeFontName(settings.fontFamily) || "No monospace fonts found"}
                  </option>
                )}
                {monoFonts.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Chinese Font</Label>
              <Select
                value={normalizeFontName(settings.fontFamilySecondary || "")}
                onChange={(e) =>
                  update({ fontFamilySecondary: normalizeFontName(e.target.value) })
                }
              >
                <option value="">None</option>
                {chineseFonts.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Font Size</Label>
              <Input
                type="number"
                min={8}
                max={32}
                value={settings.fontSize}
                onChange={(e) => update({ fontSize: Number(e.target.value) })}
                className="h-9"
              />
            </div>
            <div />
          </div>

          {/* Cursor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cursor Style</Label>
              <Select
                value={settings.cursorStyle}
                onChange={(e) =>
                  update({
                    cursorStyle: e.target.value as "block" | "underline" | "bar",
                  })
                }
              >
                <option value="block">Block</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cursor Blink</Label>
              <Select
                value={settings.cursorBlink ? "on" : "off"}
                onChange={(e) =>
                  update({ cursorBlink: e.target.value === "on" })
                }
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto text-muted-foreground"
            onClick={() => invoke("config_open_folder")}
          >
            <FolderOpen className="size-4 mr-1.5" />
            Open Config Folder
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(settings)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
