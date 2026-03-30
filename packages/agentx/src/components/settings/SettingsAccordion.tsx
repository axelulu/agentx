import { cn } from "@/lib/utils";
import { l10n } from "@agentx/l10n";
import { ChevronRightIcon, Trash2Icon, CheckIcon, PlusIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// AccordionSection — list of cards + add buttons + empty state
// ---------------------------------------------------------------------------

interface AccordionSectionProps {
  hasItems: boolean;
  children: React.ReactNode;
  addActions: { label: string; onClick: () => void }[];
  emptyMessage?: string;
}

export function AccordionSection({
  hasItems,
  children,
  addActions,
  emptyMessage,
}: AccordionSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {addActions.map((action) => (
          <AddButton key={action.label} label={action.label} onClick={action.onClick} />
        ))}
      </div>
      {hasItems ? (
        <div className="space-y-1.5">{children}</div>
      ) : (
        emptyMessage && (
          <div className="rounded-lg border border-dashed border-border flex items-center justify-center py-6 text-[12px] text-muted-foreground/40">
            {emptyMessage}
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccordionCard — a single expandable settings card
// ---------------------------------------------------------------------------

interface AccordionCardProps {
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  title: string;
  subtitle?: React.ReactNode;
  titlePrefix?: React.ReactNode;
  active?: boolean;
  activeLabel?: string;
  onActivate?: () => void;
  enabled?: boolean;
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
  onActivate,
  enabled,
  children,
}: AccordionCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-150",
        expanded
          ? "bg-foreground/[0.02] border-border shadow-sm"
          : "bg-card border-border hover:bg-foreground/[0.02] hover:border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 pl-3 py-2 text-left min-w-0 rounded-md hover:bg-foreground/[0.03] transition-colors"
        >
          <ChevronRightIcon
            className={cn(
              "w-3.5 h-3.5 shrink-0 transition-all duration-150",
              expanded ? "rotate-90 text-foreground/70" : "text-muted-foreground",
            )}
          />
          {typeof enabled === "boolean" && (
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                enabled ? "bg-foreground/60" : "bg-foreground/[0.12]",
              )}
            />
          )}
          {titlePrefix}
          <span className="text-[13px] text-foreground flex-1 truncate">
            {title || l10n.t("Untitled")}
          </span>
          {subtitle && (
            <span className="text-[11px] text-muted-foreground/60 shrink-0">{subtitle}</span>
          )}
          {active && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-foreground/[0.05] text-foreground text-[10px] font-medium leading-none shrink-0">
              <CheckIcon className="w-2.5 h-2.5" />
              {activeLabel ?? l10n.t("Active")}
            </span>
          )}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-0.5 pr-2 shrink-0">
          {onActivate && !active && (
            <button
              type="button"
              onClick={onActivate}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md bg-foreground/[0.05] hover:bg-foreground/[0.08] transition-colors"
            >
              {l10n.t("Set Active")}
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title={l10n.t("Remove")}
          >
            <Trash2Icon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && <div className="px-3 pb-3 pt-1 space-y-2.5">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldRow — label + input pair used inside accordion detail
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  align?: "center" | "start";
  children: React.ReactNode;
}

export function FieldRow({ label, align = "center", children }: FieldRowProps) {
  return (
    <div className={cn("flex gap-3", align === "start" ? "items-start" : "items-center")}>
      <label
        className={cn(
          "w-14 shrink-0 text-[11px] text-muted-foreground/70 text-right",
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
// AddButton — ghost button for adding new items
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-[12px] font-medium text-background hover:bg-foreground/90 transition-colors"
    >
      <PlusIcon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ToggleSwitch — custom pill toggle
// ---------------------------------------------------------------------------

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 cursor-pointer group/toggle"
    >
      <span
        className={cn(
          "relative w-7 h-4 rounded-full transition-colors",
          checked ? "bg-foreground" : "bg-foreground/[0.12]",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] w-3 h-3 rounded-full transition-all duration-150",
            checked ? "left-[14px] bg-background" : "left-[2px] bg-foreground/25",
          )}
        />
      </span>
      {label && (
        <span className="text-[11px] text-muted-foreground group-hover/toggle:text-foreground transition-colors">
          {label}
        </span>
      )}
    </button>
  );
}
