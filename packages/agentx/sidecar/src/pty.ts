/**
 * PtyManager — manages PTY sessions for the embedded terminal.
 *
 * Each session wraps a node-pty instance and forwards data/exit events
 * via the provided pushNotification callback.
 *
 * node-pty is loaded lazily (dynamic require) because it is a native addon
 * marked as external in the esbuild config.  When the sidecar runs inside
 * the packaged .app bundle, node-pty is not available on the module search
 * path — a top-level import would crash the entire sidecar at startup even
 * though PTY is an optional feature.
 */

import { homedir } from "os";

type NotifyFn = (method: string, params: unknown) => void;

// Lazy-loaded node-pty module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ptyModule: any = null;

function getPty() {
  if (!ptyModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ptyModule = require("node-pty");
    } catch {
      throw new Error(
        "node-pty is not available. Terminal functionality requires node-pty to be installed.",
      );
    }
  }
  return ptyModule;
}

interface IPty {
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (e: { exitCode: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

export class PtyManager {
  private sessions = new Map<string, IPty>();
  private notify: NotifyFn;

  constructor(notify: NotifyFn) {
    this.notify = notify;
  }

  create(sessionId: string, cols: number, rows: number, cwd?: string): void {
    if (this.sessions.has(sessionId)) {
      this.destroy(sessionId);
    }

    const pty = getPty();

    const shell =
      process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/zsh");

    const p: IPty = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: cwd || homedir(),
      env: process.env as Record<string, string>,
    });

    p.onData((data: string) => {
      this.notify("terminal:data", { sessionId, data });
    });

    p.onExit(({ exitCode }: { exitCode: number }) => {
      this.sessions.delete(sessionId);
      this.notify("terminal:exit", { sessionId, exitCode });
    });

    this.sessions.set(sessionId, p);
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.resize(cols, rows);
  }

  destroy(sessionId: string): void {
    const p = this.sessions.get(sessionId);
    if (p) {
      p.kill();
      this.sessions.delete(sessionId);
    }
  }

  destroyAll(): void {
    for (const [, p] of this.sessions) {
      p.kill();
    }
    this.sessions.clear();
  }
}
