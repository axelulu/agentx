import { cn } from "@/lib/utils";
import { l10n } from "@workspace/l10n";
import { ChevronDownIcon, Trash2Icon, CheckIcon, PlusIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// AccordionCard — a single expandable settings card
// ---------------------------------------------------------------------------

interface AccordionCardProps {
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  /** Primary label shown in the collapsed row */
  title: string;
  /** Secondary info shown to the right of the title */
  subtitle?: string;
  /** Renders before the title (e.g. type icon) */
  titlePrefix?: React.ReactNode;
  /** If true, card gets green border + "Active" badge */
  active?: boolean;
  activeLabel?: string;
  /** Show enabled/disabled status dot (for items with an enabled toggle) */
  enabled?: boolean;
  /** Expanded detail content */
  children: React.ReactNode;
}

export function AccordionCard({
  expanded,
  onToggle,
  onRemove,
  title,
  subtitle,
  titlePrefix,
  active,
  activeLabel,
  enabled,
  children,
}: AccordionCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-colors",
        active ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-border",
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-foreground/[0.03] transition-colors"
      >
        {typeof enabled === "boolean" && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
            )}
          />
        )}
        {titlePrefix}
        <span className="text-[13px] text-foreground flex-1 truncate">
          {title || l10n.t("Untitled")}
        </span>
        {subtitle && <span className="text-[11px] text-muted-foreground/50">{subtitle}</span>}
        {active && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-medium leading-none">
            <CheckIcon className="w-2.5 h-2.5" />
            {activeLabel ?? l10n.t("Active")}
          </span>
        )}
        <ChevronDownIcon
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground/30 transition-transform duration-150 shrink-0",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/50 px-3 pb-3 pt-2.5 space-y-2.5">
          {children}

          {/* Delete button — always bottom-right */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={l10n.t("Remove")}
            >
              <Trash2Icon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldRow — label + input pair used inside accordion detail
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  /** Use "start" for multi-line content like textareas */
  align?: "center" | "start";
  children: React.ReactNode;
}

export function FieldRow({ label, align = "center", children }: FieldRowProps) {
  return (
    <div className={cn("flex gap-3", align === "start" ? "items-start" : "items-center")}>
      <label
        className={cn(
          "w-14 shrink-0 text-[11px] text-muted-foreground/50 text-right",
          align === "start" && "pt-2",
        )}
      >
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddButton — small bordered button for adding new items
// ---------------------------------------------------------------------------

interface AddButtonProps {
  label: string;
  onClick: () => void;
}

export function AddButton({ label, onClick }: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
    >
      <PlusIcon className="w-3 h-3" />
      {label}
    </button>
  );
}
