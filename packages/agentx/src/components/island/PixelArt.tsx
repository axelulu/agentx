/**
 * Pixel Art components for the Dynamic Island.
 * Uses CSS box-shadow technique to render pixel sprites without external assets.
 * Each "pixel" is rendered as a box-shadow on a tiny base element, then scaled up.
 */

const PX = 2; // scale factor per pixel

interface PixelSpriteProps {
  pixels: string; // encoded pixel data
  palette: Record<string, string>; // char -> color map
  size?: number; // grid size (e.g. 8 = 8x8)
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Render a pixel sprite from a string grid.
 * Each character maps to a color in the palette. '.' = transparent.
 */
function PixelSprite({
  pixels,
  palette,
  size = 8,
  scale = PX,
  className,
  style,
}: PixelSpriteProps) {
  const rows = pixels
    .trim()
    .split("\n")
    .map((r) => r.trim());
  const shadows: string[] = [];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === "." || ch === " ") continue;
      const color = palette[ch] || "#fff";
      shadows.push(`${x * scale}px ${y * scale}px 0 0 ${color}`);
    }
  }

  return (
    <div
      className={className}
      style={{
        width: scale,
        height: scale,
        boxShadow: shadows.join(", "),
        // Ensure the sprite area is properly sized
        display: "inline-block",
        marginRight: (size - 1) * scale,
        marginBottom: (rows.length - 1) * scale,
        ...style,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Pixel Art Palettes
// ---------------------------------------------------------------------------

const AGENT_PALETTE: Record<string, string> = {
  b: "#1a1a2e", // dark body
  h: "#16213e", // head dark
  f: "#e2e8f0", // face/screen
  e: "#4ade80", // eyes/accent green
  g: "#22c55e", // eyes bright
  a: "#3b82f6", // antenna blue
  w: "#f8fafc", // white highlight
  s: "#64748b", // shadow
  d: "#334155", // dark detail
};

const FILE_PALETTE: Record<string, string> = {
  f: "#e2e8f0", // paper
  b: "#3b82f6", // blue accent
  d: "#94a3b8", // dark line
  c: "#cbd5e1", // corner fold
};

const TERMINAL_PALETTE: Record<string, string> = {
  b: "#1a1a2e", // bg
  f: "#e2e8f0", // frame
  g: "#4ade80", // green text
  r: "#ef4444", // red
  y: "#facc15", // yellow
  o: "#fb923c", // orange
};

const THINKING_PALETTE: Record<string, string> = {
  d: "#a78bfa", // dot purple
  l: "#c4b5fd", // dot light
};

const CHECK_PALETTE: Record<string, string> = {
  g: "#4ade80",
};

const ERROR_PALETTE: Record<string, string> = {
  r: "#ef4444",
};

const APPROVAL_PALETTE: Record<string, string> = {
  y: "#facc15", // yellow warning
  b: "#1a1a2e", // dark
  w: "#f8fafc", // white
};

// ---------------------------------------------------------------------------
// Sprite Data (8x8 grids)
// ---------------------------------------------------------------------------

const AGENT_IDLE = `
...aa...
..abba..
.ffffff.
.fegef.
.ffffff.
..bbbb..
.bb..bb.
.dd..dd.
`;

const AGENT_WORKING = `
...aa...
..abba..
.ffffff.
.fgfgf.
.ffffff.
..bwbb..
.bb..bb.
..dd.dd.
`;

const FILE_SPRITE = `
.ffffc.
.ffffc.
.fdddf.
.fffff.
.fdddf.
.fffff.
.fdddf.
.ffffff.
`;

const TERMINAL_SPRITE = `
ffffffff
fbbbbbf.
fbgbbbf.
fbbgbbf.
fbbbbbf.
fbbbbbf.
fbbbbbf.
ffffffff
`;

const CHECK_SPRITE = `
........
.......g
......g.
.g...g..
..g.g...
...g....
........
........
`;

const ERROR_SPRITE = `
........
.r....r.
..r..r..
...rr...
...rr...
..r..r..
.r....r.
........
`;

const APPROVAL_SPRITE = `
...yy...
..yyyy..
.yybbyy.
.yybbyy.
.yyyyyy.
..yyyy..
...yy...
...bb...
`;

// ---------------------------------------------------------------------------
// Exported Icon Components
// ---------------------------------------------------------------------------

export function PixelAgent({
  working = false,
  className,
  style,
}: {
  working?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <PixelSprite
      pixels={working ? AGENT_WORKING : AGENT_IDLE}
      palette={AGENT_PALETTE}
      className={className}
      style={style}
    />
  );
}

export function PixelFile({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <PixelSprite pixels={FILE_SPRITE} palette={FILE_PALETTE} className={className} style={style} />
  );
}

export function PixelTerminal({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <PixelSprite
      pixels={TERMINAL_SPRITE}
      palette={TERMINAL_PALETTE}
      className={className}
      style={style}
    />
  );
}

export function PixelCheck({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <PixelSprite
      pixels={CHECK_SPRITE}
      palette={CHECK_PALETTE}
      className={className}
      style={style}
    />
  );
}

export function PixelError({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <PixelSprite
      pixels={ERROR_SPRITE}
      palette={ERROR_PALETTE}
      className={className}
      style={style}
    />
  );
}

export function PixelApproval({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <PixelSprite
      pixels={APPROVAL_SPRITE}
      palette={APPROVAL_PALETTE}
      className={className}
      style={style}
    />
  );
}

// ── Tab icons ──

const CHAT_PALETTE: Record<string, string> = { c: "#4ade80", d: "#22c55e" };
const CHAT_SPRITE = `
..cccc..
.cccccc.
cccccccc
cccccccc
.cccccc.
..ccdc..
....dc..
.....c..
`;

const LIST_PALETTE: Record<string, string> = { b: "#3b82f6", d: "#60a5fa", w: "#e2e8f0" };
const LIST_SPRITE = `
........
.bwwwww.
........
.bwwwww.
........
.bwwwww.
........
........
`;

export function PixelChatIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <PixelSprite pixels={CHAT_SPRITE} palette={CHAT_PALETTE} className={className} style={style} />
  );
}

export function PixelListIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <PixelSprite pixels={LIST_SPRITE} palette={LIST_PALETTE} className={className} style={style} />
  );
}

/**
 * Animated thinking dots — three dots pulsing in sequence.
 */
export function PixelThinkingDots({ className }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-[3px] ${className || ""}`}>
      <span
        className="inline-block w-[4px] h-[4px] rounded-none"
        style={{
          backgroundColor: THINKING_PALETTE.d,
          animation: "island-dot-pulse 1.2s ease-in-out infinite",
        }}
      />
      <span
        className="inline-block w-[4px] h-[4px] rounded-none"
        style={{
          backgroundColor: THINKING_PALETTE.l,
          animation: "island-dot-pulse 1.2s ease-in-out 0.2s infinite",
        }}
      />
      <span
        className="inline-block w-[4px] h-[4px] rounded-none"
        style={{
          backgroundColor: THINKING_PALETTE.d,
          animation: "island-dot-pulse 1.2s ease-in-out 0.4s infinite",
        }}
      />
    </div>
  );
}

/**
 * Get the appropriate pixel icon for a tool name.
 */
export function PixelToolIcon({
  toolName,
  className,
  style,
}: {
  toolName: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (toolName.includes("file") || toolName.includes("read") || toolName.includes("write")) {
    return <PixelFile className={className} style={style} />;
  }
  if (toolName.includes("shell") || toolName.includes("terminal") || toolName.includes("exec")) {
    return <PixelTerminal className={className} style={style} />;
  }
  return <PixelAgent working className={className} style={style} />;
}

// ---------------------------------------------------------------------------
// System stats pixel art — CPU icon, MEM icon, stat bar
// ---------------------------------------------------------------------------

/** 6x6 CPU chip icon */
const CPU_PIXELS = `
..aa..
.abba.
abccba
abccba
.abba.
..aa..`;
const CPU_PALETTE: Record<string, string> = {
  a: "rgba(255,255,255,0.3)",
  b: "rgba(255,255,255,0.15)",
  c: "#4ade80",
};

export function PixelCpuIcon({ style }: { style?: React.CSSProperties }) {
  return <PixelSprite pixels={CPU_PIXELS} palette={CPU_PALETTE} size={6} style={style} />;
}

/** 6x6 Memory chip icon */
const MEM_PIXELS = `
aabbaa
acccca
abbbba
acccca
abbbba
aabbaa`;
const MEM_PALETTE: Record<string, string> = {
  a: "rgba(255,255,255,0.3)",
  b: "rgba(255,255,255,0.15)",
  c: "#60a5fa",
};

export function PixelMemIcon({ style }: { style?: React.CSSProperties }) {
  return <PixelSprite pixels={MEM_PIXELS} palette={MEM_PALETTE} size={6} style={style} />;
}

/**
 * Pixel-art progress bar for system stats.
 * 8 segments wide, each segment = 2px (PX scale). Color coded by threshold.
 */
export function PixelStatBar({ percent, style }: { percent: number; style?: React.CSSProperties }) {
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * 8);
  const color = percent >= 80 ? "#f87171" : percent >= 50 ? "#facc15" : "#4ade80";
  const emptyColor = "rgba(255,255,255,0.08)";

  const shadows: string[] = [];
  for (let i = 0; i < 8; i++) {
    shadows.push(`${i * PX}px 0px 0 0 ${i < filled ? color : emptyColor}`);
    shadows.push(`${i * PX}px ${PX}px 0 0 ${i < filled ? color : emptyColor}`);
  }

  return (
    <div
      style={{
        width: PX,
        height: PX,
        boxShadow: shadows.join(", "),
        display: "inline-block",
        marginRight: 7 * PX,
        marginBottom: PX,
        ...style,
      }}
    />
  );
}
