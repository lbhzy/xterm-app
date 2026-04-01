import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Terminal, type ConnectionConfig, type TerminalHandle } from "./components/Terminal";
import { ConnectDialog } from "./components/ConnectDialog";
import { QuickCommandBar } from "./components/QuickCommandBar";
import { QuickCommandManager } from "./components/QuickCommandManager";
import { BottomPanel, type PanelTab } from "./components/BottomPanel";
import { HexView } from "./components/HexView";
import { Sidebar } from "./components/Sidebar";
import { SessionManager } from "./components/SessionManager";
import { SettingsDialog } from "./components/SettingsDialog";
import { loadQuickCommands, saveQuickCommands, type QuickCommand } from "@/lib/quick-commands";
import { loadSavedSessions, saveSessions, type SavedSession } from "@/lib/saved-sessions";
import { loadTerminalSettings, saveTerminalSettings, type TerminalSettings } from "@/lib/terminal-settings";
import { loadTriggers, saveTriggers, type Trigger } from "@/lib/triggers";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { TriggerManager } from "@/components/TriggerManager";
import {
  Plus, X, TerminalSquare, Globe, Usb, Zap, Binary,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TabInfo {
  id: number;
  label: string;
  config: ConnectionConfig;
}

function getTabLabel(config: ConnectionConfig): string {
  switch (config.type) {
    case "pty":
      return config.command ? config.command.split(/\s/)[0].split("/").pop()! : "Local Shell";
    case "ssh":
      return `${config.username}@${config.host}`;
    case "serial":
      return config.portName;
  }
}

function getTabIcon(type: ConnectionConfig["type"]) {
  switch (type) {
    case "pty":
      return <TerminalSquare className="size-3.5" />;
    case "ssh":
      return <Globe className="size-3.5" />;
    case "serial":
      return <Usb className="size-3.5" />;
  }
}

// VS Code-style layout icons (codicons)
function SidebarLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2h12v12H2V2zm1 1v10h3V3H3zm4 0v10h6V3H7z" fill="currentColor" />
    </svg>
  );
}

function SidebarLeftOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2h12v12H2V2zm1 1v10h3V3H3zm4 0v10h6V3H7z" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

function PanelBottomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2h12v12H2V2zm1 1v6h10V3H3zm0 7v3h10v-3H3z" fill="currentColor" />
    </svg>
  );
}

function PanelBottomOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2h12v12H2V2zm1 1v6h10V3H3zm0 7v3h10v-3H3z" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

function App() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTab, setActiveTab] = useState(-1);
  const [nextId, setNextId] = useState(1);
  const [showDialog, setShowDialog] = useState(false);
  const [quickCommands, setQuickCommands] = useState<QuickCommand[]>([]);
  const [showCommandManager, setShowCommandManager] = useState(false);
  const terminalRefs = useRef<Map<number, TerminalHandle>>(new Map());
  const [hexDataMap, setHexDataMap] = useState<Map<number, string>>(new Map());
  const [hexEnabled, setHexEnabled] = useState(false);
  const hexEnabledRef = useRef(hexEnabled);
  hexEnabledRef.current = hexEnabled;

  // Saved sessions
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [showSessionManager, setShowSessionManager] = useState(false);

  // Triggers
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [showTriggerManager, setShowTriggerManager] = useState(false);

  // Layout visibility
  const [showSidebar, setShowSidebar] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);

  // Terminal size tracking
  const [terminalSize, setTerminalSize] = useState<{ rows: number; cols: number } | null>(null);

  // Terminal settings
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettings>({
    fontSize: 14,
    fontFamily: "Cascadia Mono",
    fontFamilySecondary: "",
    cursorBlink: true,
    cursorStyle: "block",
    themeName: "Dark (Default)",
    appTheme: "dark-blue",
  });
  const [showSettings, setShowSettings] = useState(false);

  // Apply app theme to root element
  useEffect(() => {
    document.documentElement.setAttribute("data-app-theme", terminalSettings.appTheme);
  }, [terminalSettings.appTheme]);

  // Load configs from Tauri on mount
  useEffect(() => {
    loadQuickCommands().then(setQuickCommands);
    loadSavedSessions().then(setSavedSessions);
    loadTerminalSettings().then(setTerminalSettings);
    loadTriggers().then(setTriggers);
    invoke<Record<string, unknown> | null>("config_read", { key: "layout" }).then((data) => {
      if (!data) return;
      if (typeof data.showSidebar === "boolean") setShowSidebar(data.showSidebar);
      if (typeof data.showBottomPanel === "boolean") setShowBottomPanel(data.showBottomPanel);
      if (typeof data.sidebarWidth === "number") setSidebarWidth(data.sidebarWidth);
      if (typeof data.bottomPanelHeight === "number") setBottomPanelHeight(data.bottomPanelHeight);
    }).catch(() => {});
  }, []);

  // Save layout on change
  const layoutRef = useRef({ showSidebar, showBottomPanel, sidebarWidth, bottomPanelHeight });
  layoutRef.current = { showSidebar, showBottomPanel, sidebarWidth, bottomPanelHeight };
  const saveLayoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLayout = useCallback(() => {
    if (saveLayoutTimer.current !== null) {
      clearTimeout(saveLayoutTimer.current);
    }
    saveLayoutTimer.current = setTimeout(() => {
      invoke("config_write", { key: "layout", value: layoutRef.current });
    }, 300);
  }, []);
  useEffect(saveLayout, [showSidebar, showBottomPanel, sidebarWidth, bottomPanelHeight, saveLayout]);

  const MAX_HEX_SIZE = 64 * 1024; // Keep last 64KB per tab

  const addTab = useCallback(
    (config: ConnectionConfig) => {
      const id = nextId;
      setNextId((n) => n + 1);
      setTabs((prev) => [...prev, { id, label: getTabLabel(config), config }]);
      setActiveTab(id);
      setShowDialog(false);
    },
    [nextId]
  );

  const closeTab = useCallback(
    (id: number) => {
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        if (activeTab === id) {
          if (filtered.length > 0) {
            setActiveTab(filtered[filtered.length - 1].id);
          } else {
            setActiveTab(-1);
          }
        }
        return filtered;
      });
    },
    [activeTab]
  );

  const sendQuickCommand = useCallback(
    (command: string) => {
      const handle = terminalRefs.current.get(activeTab);
      if (handle) handle.sendCommand(command);
    },
    [activeTab]
  );

  const handleSaveCommands = useCallback((cmds: QuickCommand[]) => {
    setQuickCommands(cmds);
    saveQuickCommands(cmds);
    setShowCommandManager(false);
  }, []);

  const handleSaveSessions = useCallback((sessions: SavedSession[]) => {
    setSavedSessions(sessions);
    saveSessions(sessions);
    setShowSessionManager(false);
  }, []);

  const handleSaveSettings = useCallback((s: TerminalSettings) => {
    setTerminalSettings(s);
    saveTerminalSettings(s);
    setShowSettings(false);
  }, []);

  const handleSaveTriggers = useCallback((t: Trigger[]) => {
    setTriggers(t);
    saveTriggers(t);
    setShowTriggerManager(false);
  }, []);

  const handleToggleTrigger = useCallback((id: string) => {
    setTriggers((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t));
      saveTriggers(next);
      return next;
    });
  }, []);

  const setTerminalRef = useCallback(
    (tabId: number) => (handle: TerminalHandle | null) => {
      if (handle) {
        terminalRefs.current.set(tabId, handle);
      } else {
        terminalRefs.current.delete(tabId);
      }
    },
    []
  );

  const onTerminalOutput = useCallback(
    (tabId: number) => (data: string) => {
      if (!hexEnabledRef.current) return;
      setHexDataMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(tabId) ?? "";
        let updated = existing + data;
        if (updated.length > MAX_HEX_SIZE) {
          updated = updated.slice(updated.length - MAX_HEX_SIZE);
        }
        next.set(tabId, updated);
        return next;
      });
    },
    [MAX_HEX_SIZE]
  );

  const onTerminalResize = useCallback(
    (tabId: number) => (rows: number, cols: number) => {
      if (tabId === activeTab) {
        setTerminalSize({ rows, cols });
      }
    },
    [activeTab]
  );

  const activeTabInfo = tabs.find((t) => t.id === activeTab);

  const clearHexData = useCallback(() => {
    setHexDataMap((prev) => {
      const next = new Map(prev);
      next.set(activeTab, "");
      return next;
    });
  }, [activeTab]);

  const currentHexData = hexDataMap.get(activeTab) ?? "";

  const bottomTabs: PanelTab[] = useMemo(
    () => [
      {
        id: "quick-commands",
        label: "Quick Commands",
        icon: <Zap className="size-3" />,
        content: (
          <QuickCommandBar
            commands={quickCommands}
            onSend={sendQuickCommand}
            onManage={() => setShowCommandManager(true)}
          />
        ),
      },
      {
        id: "hex-view",
        label: "Hex",
        icon: <Binary className="size-3" />,
        content: (
          <HexView
            data={currentHexData}
            enabled={hexEnabled}
            onToggle={() => setHexEnabled((v) => !v)}
            onClear={clearHexData}
          />
        ),
      },
    ],
    [quickCommands, sendQuickCommand, currentHexData, clearHexData, hexEnabled]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Title Bar */}
      <div
        data-tauri-drag-region
        className="titlebar flex items-center h-11 bg-card/80 backdrop-blur-sm border-b border-border/60 shrink-0 select-none"
      >
        {/* Left spacer for macOS traffic lights */}
        <div className="w-[78px] shrink-0" data-tauri-drag-region />

        {/* Title / drag area */}
        <div className="flex-1 text-xs text-muted-foreground/70 font-medium tracking-wide" data-tauri-drag-region>
          Xterm App
        </div>

        {/* Layout toggle buttons */}
        <div className="flex items-center gap-0.5 px-2 shrink-0 titlebar-buttons">
          <button
            className={cn(
              "flex items-center justify-center h-7 w-7 rounded transition-colors duration-100",
              showSidebar
                ? "text-foreground/90"
                : "text-muted-foreground/50 hover:text-foreground/70"
            )}
            onClick={() => setShowSidebar((v) => !v)}
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            {showSidebar ? <SidebarLeftIcon /> : <SidebarLeftOffIcon />}
          </button>
          <button
            className={cn(
              "flex items-center justify-center h-7 w-7 rounded transition-colors duration-100",
              showBottomPanel
                ? "text-foreground/90"
                : "text-muted-foreground/50 hover:text-foreground/70"
            )}
            onClick={() => setShowBottomPanel((v) => !v)}
            title={showBottomPanel ? "Hide bottom panel" : "Show bottom panel"}
          >
            {showBottomPanel ? <PanelBottomIcon /> : <PanelBottomOffIcon />}
          </button>
        </div>
      </div>

      {/* Main Area: Sidebar + Content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          sessions={savedSessions}
          triggers={triggers}
          onOpenSession={addTab}
          onManageSessions={() => setShowSessionManager(true)}
          onManageTriggers={() => setShowTriggerManager(true)}
          onToggleTrigger={handleToggleTrigger}
          onSettings={() => setShowSettings(true)}
          visible={showSidebar}
          onVisibleChange={setShowSidebar}
          panelWidth={sidebarWidth}
          onPanelWidthChange={setSidebarWidth}
        />

        {/* Content: Tab Bar + Terminal + Bottom Panel */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Tab Bar - only shown when tabs exist */}
          {tabs.length > 0 && (
            <div className="flex items-center bg-card/50 border-b border-border/50 h-9 shrink-0 overflow-x-auto scrollbar-thin">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 h-full cursor-pointer border-r border-border/30 text-xs select-none transition-all duration-150",
                    activeTab === tab.id
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-foreground/80"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className={cn("transition-colors", activeTab === tab.id ? "text-primary" : "")}>
                    {getTabIcon(tab.config.type)}
                  </span>
                  <span className="max-w-[140px] truncate">{tab.label}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 hover:bg-muted/80 rounded p-0.5 transition-all duration-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Terminal Area */}
          <div className="flex-1 relative min-h-0">
            {tabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-6 p-8">
                {savedSessions.length > 0 ? (
                  <>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-foreground/70">Saved Sessions</p>
                      <p className="text-xs text-muted-foreground/70">Click a session to connect, or create a new connection</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                      {savedSessions.map((session) => (
                        <button
                          key={session.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card/60 hover:bg-accent/40 hover:border-primary/30 transition-all duration-150 text-left group"
                          onClick={() => addTab(session.config)}
                          title={`Connect: ${session.name}`}
                        >
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/40 text-muted-foreground/60 group-hover:text-primary/80 transition-colors shrink-0">
                            {getTabIcon(session.config.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate text-foreground/85 group-hover:text-foreground transition-colors">
                              {session.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground/50 truncate font-mono">
                              {session.config.type === "pty"
                                ? session.config.command || "Local Shell"
                                : session.config.type === "ssh"
                                ? `${session.config.username}@${session.config.host}:${session.config.port}`
                                : `${session.config.portName} @ ${session.config.baudRate}`}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/40 text-muted-foreground/60">
                      <TerminalSquare className="size-8" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-foreground/70">No active sessions</p>
                      <p className="text-xs text-muted-foreground/70">Use the sidebar to add sessions and connect</p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              tabs.map((tab) => (
                <Terminal
                  key={tab.id}
                  ref={setTerminalRef(tab.id)}
                  config={tab.config}
                  settings={terminalSettings}
                  triggers={triggers}
                  active={activeTab === tab.id}
                  onOutput={onTerminalOutput(tab.id)}
                  onResize={onTerminalResize(tab.id)}
                  onSendCommand={(cmd) => {
                    const handle = terminalRefs.current.get(tab.id);
                    if (handle) handle.sendCommand(cmd);
                  }}
                />
              ))
            )}
          </div>

          {/* Bottom Panel */}
          {showBottomPanel && <BottomPanel tabs={bottomTabs} height={bottomPanelHeight} onHeightChange={setBottomPanelHeight} />}
        </div>
      </div>

      {/* Connection Dialog */}
      <ConnectDialog
        open={showDialog}
        onConnect={addTab}
        onCancel={() => setShowDialog(false)}
      />

      {/* Quick Command Manager */}
      <QuickCommandManager
        open={showCommandManager}
        commands={quickCommands}
        onSave={handleSaveCommands}
        onCancel={() => setShowCommandManager(false)}
      />

      {/* Session Manager */}
      <SessionManager
        open={showSessionManager}
        sessions={savedSessions}
        onSave={handleSaveSessions}
        onCancel={() => setShowSessionManager(false)}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettings}
        settings={terminalSettings}
        onSave={handleSaveSettings}
        onCancel={() => setShowSettings(false)}
      />

      {/* Trigger Manager */}
      <TriggerManager
        open={showTriggerManager}
        triggers={triggers}
        onSave={handleSaveTriggers}
        onCancel={() => setShowTriggerManager(false)}
      />

      {/* Status Bar */}
      <div className="flex items-center justify-between h-6 px-3 bg-primary/10 border-t border-primary/20 shrink-0 text-[11px] text-muted-foreground select-none">
        <div className="flex items-center gap-3">
          {activeTabInfo && (
            <>
              <span className="flex items-center gap-1.5 text-foreground/80">
                {getTabIcon(activeTabInfo.config.type)}
                {activeTabInfo.label}
              </span>
              {activeTabInfo.config.type === "ssh" && (
                <span className="text-muted-foreground/70">{activeTabInfo.config.host}:{activeTabInfo.config.port}</span>
              )}
              {activeTabInfo.config.type === "serial" && (
                <span className="text-muted-foreground/70">{activeTabInfo.config.portName} @ {activeTabInfo.config.baudRate}</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hexEnabled && (
            <span className="flex items-center gap-1 text-green-400/90">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              REC
            </span>
          )}
          {tabs.length > 0 && terminalSize && (
            <span className="font-mono text-muted-foreground/70">
              {terminalSize.cols}×{terminalSize.rows}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
