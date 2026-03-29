/**
 * PtyManager — manages PTY sessions for the embedded terminal.
 *
 * Each session wraps a node-pty instance and forwards data/exit events
 * via the provided pushNotification callback.
 */

import * as pty from "node-pty";
import { homedir } from "os";

type NotifyFn = (method: string, params: unknown) => void;

export class PtyManager {
  private sessions = new Map<string, pty.IPty>();
  private notify: NotifyFn;

  constructor(notify: NotifyFn) {
    this.notify = notify;
  }

  create(sessionId: string, cols: number, rows: number, cwd?: string): void {
    if (this.sessions.has(sessionId)) {
      this.destroy(sessionId);
    }

    const shell =
      process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/zsh");

    const p = pty.spawn(shell, [], {
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
