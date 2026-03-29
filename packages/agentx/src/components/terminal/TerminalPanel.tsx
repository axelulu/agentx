import { useEffect, useRef, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "@/slices/store";
import { setTerminalOpen } from "@/slices/uiSlice";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { XIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { l10n } from "@agentx/l10n";
import "@xterm/xterm/css/xterm.css";

const darkTheme: ITheme = {
  background: "#1a1a1a",
  foreground: "#d4d4d4",
  cursor: "#d4d4d4",
  selectionBackground: "#264f78",
};

const lightTheme: ITheme = {
  background: "#f5f5f5",
  foreground: "#1a1a1a",
  cursor: "#1a1a1a",
  selectionBackground: "#add6ff",
};

function getTermTheme(): ITheme {
  return document.documentElement.classList.contains("dark") ? darkTheme : lightTheme;
}

export function TerminalPanel() {
  const dispatch = useDispatch();
  const terminalHeight = useSelector((s: RootState) => s.ui.terminalHeight);
  const appTheme = useSelector((s: RootState) => s.settings.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  const initTerminal = useCallback(async () => {
    if (mountedRef.current || !containerRef.current) return;
    mountedRef.current = true;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      theme: getTermTheme(),
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(webLinks);

    termRef.current = term;
    fitRef.current = fit;

    term.open(containerRef.current);

    // Small delay to let the DOM settle before fitting
    requestAnimationFrame(() => {
      fit.fit();
    });

    const sid = crypto.randomUUID();
    sessionIdRef.current = sid;

    // Connect xterm input to PTY
    term.onData((data) => {
      window.api.terminal.write(sid, data);
    });

    // Forward resize events to PTY
    term.onResize(({ cols, rows }) => {
      window.api.terminal.resize(sid, cols, rows);
    });

    // Listen for PTY output
    const unsubData = window.api.terminal.onData((event) => {
      if (event.sessionId === sid) {
        term.write(event.data);
      }
    });

    const unsubExit = window.api.terminal.onExit((event) => {
      if (event.sessionId === sid) {
        term.write(`\r\n[Process exited with code ${event.exitCode}]\r\n`);
      }
    });

    // Create PTY session
    try {
      await window.api.terminal.create(sid, term.cols, term.rows);
    } catch (err) {
      term.write(`\r\nFailed to create terminal session: ${err}\r\n`);
    }

    // Store cleanup refs
    (containerRef.current as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
      unsubData();
      unsubExit();
      window.api.terminal.destroy(sid).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      sessionIdRef.current = null;
      mountedRef.current = false;
    };
  }, []);

  // Mount terminal on first render
  useEffect(() => {
    initTerminal();

    return () => {
      const el = containerRef.current as (HTMLElement & { _cleanup?: () => void }) | null;
      el?._cleanup?.();
    };
  }, [initTerminal]);

  // Sync theme when app theme changes
  useEffect(() => {
    // Small delay to let the DOM class update first
    requestAnimationFrame(() => {
      if (termRef.current) {
        termRef.current.options.theme = getTermTheme();
      }
    });
  }, [appTheme]);

  // Re-fit when height changes
  useEffect(() => {
    requestAnimationFrame(() => {
      fitRef.current?.fit();
    });
  }, [terminalHeight]);

  // Also handle window resize
  useEffect(() => {
    const onResize = () => {
      requestAnimationFrame(() => {
        fitRef.current?.fit();
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      data-terminal-panel
      className="shrink-0 overflow-hidden flex flex-col"
      style={{ height: terminalHeight }}
    >
      {/* Header bar — flush against terminal content */}
      <div className="flex items-center justify-between px-2 py-1 shrink-0 bg-[#f5f5f5] dark:bg-[#1a1a1a]">
        <span className="text-xs font-medium text-muted-foreground">{l10n.t("Terminal")}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => dispatch(setTerminalOpen(false))}
              className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{l10n.t("Close Terminal")}</TooltipContent>
        </Tooltip>
      </div>

      {/* Terminal content */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
