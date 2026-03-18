"use client";

import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { l10n } from "@agentx/l10n";
import { XIcon } from "lucide-react";
import * as React from "react";

interface DialogConfigContextType {
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
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
  return (
    <DialogConfigContext.Provider value={{ closeOnClickOutside, closeOnEscape }}>
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
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40",
        className,
      )}
      style={style}
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
  const { closeOnClickOutside, closeOnEscape } = React.useContext(DialogConfigContext);

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
      <DialogOverlay style={overlayStyle} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-card border border-border flex flex-col gap-4 rounded-2xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] shadow-lg duration-200",
          maxWidthClasses[maxWidth],
          className,
        )}
        style={style}
        onPointerDownOutside={(e) => {
          if (closeOnClickOutside === false) e.preventDefault();
          onPointerDownOutside?.(e);
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
