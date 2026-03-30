"use client";

import { cn } from "@/lib/utils";
import { glassPanelStyle } from "@/lib/glassStyle";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { l10n } from "@agentx/l10n";
import { XIcon } from "lucide-react";
import * as React from "react";

interface DialogConfigContextType {
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  requestClose?: () => void;
}

const DialogConfigContext = React.createContext<DialogConfigContextType>({
  closeOnClickOutside: true,
  closeOnEscape: true,
});

function Dialog({
  closeOnClickOutside = true,
  closeOnEscape = true,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & {
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
}) {
  const requestClose = React.useCallback(() => {
    props.onOpenChange?.(false);
  }, [props.onOpenChange]);

  return (
    <DialogConfigContext.Provider value={{ closeOnClickOutside, closeOnEscape, requestClose }}>
      <DialogPrimitive.Root data-slot="dialog" {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogConfigContext.Provider>
  );
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({
  className,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 bg-black/15", className)}
      style={{ zIndex: "var(--z-modal)", ...style }}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  title,
  description,
  maxWidth = "lg",
  style,
  overlayStyle,
  onPointerDownOutside,
  onEscapeKeyDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  title?: string;
  description?: string;
  overlayStyle?: React.CSSProperties;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";
}) {
  const { closeOnClickOutside, closeOnEscape, requestClose } =
    React.useContext(DialogConfigContext);

  const maxWidthClasses = {
    xs: "sm:max-w-xs",
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
    "4xl": "sm:max-w-4xl",
    "5xl": "sm:max-w-5xl",
    "6xl": "sm:max-w-6xl",
    full: "sm:max-w-full",
  };

  return (
    <DialogPortal>
      <DialogOverlay
        style={overlayStyle}
        onClick={closeOnClickOutside !== false ? requestClose : undefined}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-glass
        className={cn(
          "border border-border/50 flex flex-col gap-4 rounded-2xl p-6 fixed top-[50%] left-[50%] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] shadow-lg",
          maxWidthClasses[maxWidth],
          className,
        )}
        style={{ zIndex: "var(--z-modal)", ...glassPanelStyle, ...style }}
        onPointerDownOutside={(e) => {
          // Radix fires a custom event whose .target is the DismissableLayer itself.
          // The real click target lives at .detail.originalEvent.target.
          const realTarget = ((e as any).detail?.originalEvent?.target ?? e.target) as HTMLElement;
          // If the click landed inside a portaled floating element (Select, Popover, etc.),
          // it is NOT a true "outside" click — prevent the dialog from closing.
          if (realTarget?.closest?.("[data-floating-ui]")) {
            e.preventDefault();
            return;
          }
          if (closeOnClickOutside === false) e.preventDefault();
          onPointerDownOutside?.(e);
        }}
        onFocusOutside={(e) => {
          // Same guard for focus events — portaled floating elements shouldn't dismiss.
          const realTarget = ((e as any).detail?.originalEvent?.target ?? e.target) as HTMLElement;
          if (realTarget?.closest?.("[data-floating-ui]")) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (closeOnEscape === false) e.preventDefault();
          onEscapeKeyDown?.(e);
        }}
        {...props}
      >
        {title && (
          <div className="flex flex-col gap-2">
            <DialogPrimitive.Title className="text-lg font-semibold leading-none">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
        )}

        {!title && (
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>{l10n.t("Dialog")}</DialogPrimitive.Title>
          </VisuallyHidden.Root>
        )}

        {children}

        {showCloseButton && (
          <DialogPrimitive.Close className="absolute top-4 right-4 rounded-lg opacity-70 transition-opacity hover:opacity-100 cursor-pointer">
            <XIcon className="h-4 w-4" />
            <span className="sr-only">{l10n.t("Close")}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export { Dialog, DialogContent, DialogOverlay, DialogPortal };
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
