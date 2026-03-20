import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ImagePreviewOverlayProps {
  src: string | null;
  onClose: () => void;
  alt?: string;
}

/**
 * Full-screen image preview overlay.
 * Click backdrop or press Escape to close.
 */
export function ImagePreviewOverlay({ src, onClose, alt = "Preview" }: ImagePreviewOverlayProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!src) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [src, handleKeyDown]);

  if (!src) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex: "var(--z-modal)" }}
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
