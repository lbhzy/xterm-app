import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

import { cn } from "@/lib/utils";
import { type TerminalSettings, getTheme, getResolvedFontFamily } from "@/lib/terminal-settings";
import type { Trigger } from "@/lib/triggers";

export type ConnectionType = "pty" | "ssh" | "serial";

export interface PtyConfig {
  type: "pty";
  command?: string;
}

export interface SshConfig {
  type: "ssh";
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  keyPath?: string;
}

export interface SerialConfig {
  type: "serial";
  portName: string;
  baudRate: number;
}

export type ConnectionConfig = PtyConfig | SshConfig | SerialConfig;

interface TerminalProps {
  config: ConnectionConfig;
  active: boolean;
  settings: TerminalSettings;
  triggers?: Trigger[];
  onOutput?: (data: string) => void;
  onResize?: (rows: number, cols: number) => void;
  onSendCommand?: (command: string) => void;
}

export interface TerminalHandle {
  sendCommand: (command: string) => void;
  getSize: () => { rows: number; cols: number } | null;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  function Terminal({ config, active, settings, triggers, onOutput, onResize, onSendCommand }, ref) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const onOutputRef = useRef(onOutput);
  onOutputRef.current = onOutput;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const triggersRef = useRef(triggers);
  triggersRef.current = triggers;
  const onSendCommandRef = useRef(onSendCommand);
  onSendCommandRef.current = onSendCommand;

  useImperativeHandle(ref, () => ({
    sendCommand: (command: string) => {
      if (sessionIdRef.current !== null) {
        invoke("session_write", { id: sessionIdRef.current, data: command });
      }
    },
    getSize: () => {
      const xterm = xtermRef.current;
      if (!xterm) return null;
      return { rows: xterm.rows, cols: xterm.cols };
    },
  }));

  useEffect(() => {
    if (!termRef.current) return;

    const xterm = new XTerm({
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontSize: settings.fontSize,
      fontFamily: getResolvedFontFamily(settings),
      theme: getTheme(settings),
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    onResizeRef.current?.(xterm.rows, xterm.cols);

    let sessionId: number | null = null;
    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    async function init() {
      const rows = xterm.rows;
      const cols = xterm.cols;

      try {
        switch (config.type) {
          case "pty":
            sessionId = await invoke<number>("pty_spawn", {
              rows,
              cols,
              command: config.command ?? null,
            });
            break;
          case "ssh":
            sessionId = await invoke<number>("ssh_connect", {
              host: config.host,
              port: config.port,
              username: config.username,
              authMethod: config.authMethod,
              password: config.password ?? null,
              keyPath: config.keyPath ?? null,
              rows,
              cols,
            });
            break;
          case "serial":
            sessionId = await invoke<number>("serial_connect", {
              portName: config.portName,
              baudRate: config.baudRate,
            });
            break;
        }
      } catch (e) {
        xterm.write(`\r\n\x1b[31mConnection failed: ${e}\x1b[0m\r\n`);
        return;
      }

      sessionIdRef.current = sessionId;

      unlistenOutput = await listen<string>(
        `session-output-${sessionId}`,
        (event) => {
          xterm.write(event.payload);
          onOutputRef.current?.(event.payload);
          // Auto-command triggers
          const ts = triggersRef.current;
          if (ts) {
            for (const trigger of ts) {
              if (!trigger.enabled || !trigger.actions.autoCommand) continue;
              try {
                const re = new RegExp(trigger.pattern);
                if (re.test(event.payload)) {
                  const cmd = trigger.actions.autoCommand.endsWith("\n")
                    ? trigger.actions.autoCommand
                    : trigger.actions.autoCommand + "\n";
                  onSendCommandRef.current?.(cmd);
                }
              } catch {}
            }
          }
        }
      );

      unlistenExit = await listen<void>(
        `session-exit-${sessionId}`,
        () => {
          xterm.write("\r\n\x1b[33m[Session ended]\x1b[0m\r\n");
        }
      );

      xterm.onData((data) => {
        if (sessionIdRef.current !== null) {
          invoke("session_write", { id: sessionIdRef.current, data });
        }
      });
    }

    init();

    const handleResize = () => {
      fitAddon.fit();
      onResizeRef.current?.(xterm.rows, xterm.cols);
      if (sessionIdRef.current !== null) {
        invoke("session_resize", {
          id: sessionIdRef.current,
          rows: xterm.rows,
          cols: xterm.cols,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Observe container resize for layout changes (panel show/hide, sidebar toggle)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (termRef.current) {
      resizeObserver.observe(termRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      unlistenOutput?.();
      unlistenExit?.();
      if (sessionIdRef.current !== null) {
        invoke("session_close", { id: sessionIdRef.current });
      }
      xterm.dispose();
    };
  }, []);

  // Refit when tab becomes active
  useEffect(() => {
    if (active && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0);
    }
  }, [active]);

  // Apply settings changes to existing terminal
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    xterm.options.fontSize = settings.fontSize;
    xterm.options.fontFamily = getResolvedFontFamily(settings);
    xterm.options.cursorBlink = settings.cursorBlink;
    xterm.options.cursorStyle = settings.cursorStyle;
    xterm.options.theme = getTheme(settings);
    fitAddonRef.current?.fit();
  }, [settings]);

  // Register trigger link providers (highlight, tooltip, click)
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm || !triggers || triggers.length === 0) return;

    const enabledTriggers = triggers.filter(
      (t) => t.enabled && (t.actions.highlight || t.actions.tooltip || t.actions.clickCommand)
    );
    if (enabledTriggers.length === 0) return;

    const disposables: { dispose: () => void }[] = [];

    for (const trigger of enabledTriggers) {
      let re: RegExp;
      try {
        re = new RegExp(trigger.pattern, "g");
      } catch {
        continue;
      }

      const disp = xterm.registerLinkProvider({
        provideLinks: (bufferLineNumber, callback) => {
          const line = xterm.buffer.active.getLine(bufferLineNumber - 1);
          if (!line) { callback(undefined); return; }
          const text = line.translateToString(true);
          re.lastIndex = 0;
          const links: any[] = [];
          let match: RegExpExecArray | null;
          while ((match = re.exec(text)) !== null) {
            const startX = match.index;
            const length = match[0].length;
            if (length === 0) { re.lastIndex++; continue; }
            links.push({
              range: {
                start: { x: startX + 1, y: bufferLineNumber },
                end: { x: startX + length + 1, y: bufferLineNumber },
              },
              text: match[0],
              activate: () => {
                if (trigger.actions.clickCommand) {
                  const cmd = trigger.actions.clickCommand.endsWith("\n")
                    ? trigger.actions.clickCommand
                    : trigger.actions.clickCommand + "\n";
                  onSendCommandRef.current?.(cmd);
                }
              },
              hover: (event: MouseEvent, text: string) => {
                if (!trigger.actions.tooltip && !trigger.actions.clickCommand) return;
                // Remove any existing trigger tooltip
                document.querySelectorAll(".xterm-trigger-tooltip").forEach((el) => el.remove());
                const tip = document.createElement("div");
                tip.className = "xterm-trigger-tooltip";
                const parts: string[] = [];
                if (trigger.actions.tooltip) parts.push(trigger.actions.tooltip);
                if (trigger.actions.clickCommand) parts.push(`Click to run: ${trigger.actions.clickCommand}`);
                tip.textContent = parts.join(" | ");
                tip.style.cssText = `
                  position: fixed;
                  z-index: 9999;
                  padding: 4px 8px;
                  border-radius: 4px;
                  font-size: 11px;
                  max-width: 300px;
                  pointer-events: none;
                  white-space: nowrap;
                  background: var(--popover);
                  color: var(--popover-foreground);
                  border: 1px solid var(--border);
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  left: ${event.clientX + 8}px;
                  top: ${event.clientY - 28}px;
                `;
                document.body.appendChild(tip);
              },
              leave: () => {
                document.querySelectorAll(".xterm-trigger-tooltip").forEach((el) => el.remove());
              },
              decorations: trigger.actions.highlight
                ? {
                    pointerCursor: !!trigger.actions.clickCommand,
                    underline: !!trigger.actions.clickCommand,
                    overviewRulerColor: trigger.actions.highlight,
                  }
                : undefined,
            });
          }
          callback(links.length > 0 ? links : undefined);
        },
      });
      disposables.push(disp);
    }

    return () => {
      disposables.forEach((d) => d.dispose());
      document.querySelectorAll(".xterm-trigger-tooltip").forEach((el) => el.remove());
    };
  }, [triggers]);

  return (
    <div
      ref={termRef}
      className={cn("w-full h-full", active ? "block" : "hidden")}
    />
  );
});
