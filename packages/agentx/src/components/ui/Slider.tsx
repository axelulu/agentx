import { useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  className?: string;
  formatValue?: (v: number) => string;
}

export function Slider({ value, onChange, min, max, step, className, formatValue }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const display = draft ?? value;
  const pct = ((display - min) / (max - min)) * 100;

  const snap = useCallback(
    (raw: number) => {
      const clamped = Math.min(max, Math.max(min, raw));
      return Math.round(clamped / step) * step;
    },
    [min, max, step],
  );

  const calcValue = useCallback(
    (e: React.PointerEvent) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      return snap(min + ratio * (max - min));
    },
    [min, max, snap, value],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraft(calcValue(e));
    },
    [calcValue],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draft === null) return;
      setDraft(calcValue(e));
    },
    [draft, calcValue],
  );

  const handlePointerUp = useCallback(() => {
    if (draft !== null) {
      onChangeRef.current(draft);
      setDraft(null);
    }
  }, [draft]);

  const isDragging = draft !== null;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-24 h-5 flex items-center cursor-pointer touch-none"
      >
        {/* Track bg */}
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-foreground/[0.08]" />
        {/* Track fill */}
        <div
          className="absolute left-0 h-[3px] rounded-full bg-foreground/40"
          style={{ width: `${pct}%` }}
        />
        {/* Thumb */}
        <div
          className={cn(
            "absolute w-3.5 h-3.5 rounded-full bg-background border-2 border-foreground/30 transition-shadow -translate-x-1/2",
            isDragging
              ? "shadow-md border-foreground/50"
              : "hover:border-foreground/50 hover:shadow-sm",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] text-muted-foreground w-8 text-right tabular-nums select-none">
        {formatValue ? formatValue(display) : display.toFixed(1)}
      </span>
    </div>
  );
}
