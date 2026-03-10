import { useRef, useEffect } from "react";
import { l10n } from "@workspace/l10n";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogClose } from "./Dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  // Keep onConfirm in a ref so the click handler always calls the latest version,
  // even if a re-render occurs between pointer-down and click.
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  });

  // Snapshot visual props while open so content stays stable during close animation
  const snapshot = useRef({ title, description, children, confirmLabel, cancelLabel, variant });
  useEffect(() => {
    if (open) {
      snapshot.current = { title, description, children, confirmLabel, cancelLabel, variant };
    }
  });

  const s = open
    ? { title, description, children, confirmLabel, cancelLabel, variant }
    : snapshot.current;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} closeOnClickOutside={false}>
      <DialogContent
        title={s.title}
        description={s.description}
        maxWidth="sm"
        showCloseButton={false}
      >
        {s.children}
        <div className="flex items-center justify-end gap-2 mt-2">
          <DialogClose asChild>
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-foreground/[0.06] transition-colors text-muted-foreground"
            >
              {s.cancelLabel ?? l10n.t("Cancel")}
            </button>
          </DialogClose>
          <button
            type="button"
            onPointerDown={(e) => {
              // Prevent Radix DismissableLayer from seeing this as an "outside" click
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmRef.current();
              onOpenChange(false);
            }}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg font-medium transition-colors",
              s.variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {s.confirmLabel ?? l10n.t("Confirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
