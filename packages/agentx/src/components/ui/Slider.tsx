import { useRef, useCallback, useEffect, useState } from "react";
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
  const [dragging, setDragging] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;

  const snap = useCallback(
    (raw: number) => {
      const clamped = Math.min(max, Math.max(min, raw));
      return Math.round(clamped / step) * step;
    },
    [min, max, step],
  );

  const valueFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      return snap(min + ratio * (max - min));
    },
    [min, max, snap, value],
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      onChange(valueFromEvent(e));
    },
    [onChange, valueFromEvent],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => onChange(valueFromEvent(e));
    const onUp = () => setDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging, onChange, valueFromEvent]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        ref={trackRef}
        onMouseDown={handlePointerDown}
        className="relative w-24 h-5 flex items-center cursor-pointer"
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
            dragging
              ? "shadow-md border-foreground/50"
              : "hover:border-foreground/50 hover:shadow-sm",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className="text-[12px] text-muted-foreground w-8 text-right tabular-nums select-none">
        {formatValue ? formatValue(value) : value.toFixed(1)}
      </span>
    </div>
  );
}
