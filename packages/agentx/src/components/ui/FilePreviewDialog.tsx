import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import { getPreviewType, fileUrl } from "@/lib/filePreview";

interface FilePreviewDialogProps {
  path: string | null;
  onClose: () => void;
}

export function FilePreviewDialog({ path, onClose }: FilePreviewDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!path) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [path, handleKeyDown]);

  if (!path) return null;

  const type = getPreviewType(path);
  const url = fileUrl(path);
  const name = path.split("/").pop() ?? path;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/15" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <XIcon className="w-5 h-5" />
      </button>

      {/* Content */}
      <div
        className="relative z-10 max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "image" && (
          <img src={url} alt={name} className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        )}
        {type === "video" && (
          <video src={url} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg" />
        )}
        {type === "audio" && (
          <div className="bg-card border border-border rounded-xl p-6 min-w-[320px]">
            <p className="text-sm text-foreground mb-4 truncate">{name}</p>
            <audio src={url} controls autoPlay className="w-full" />
          </div>
        )}
      </div>

      {/* File name at bottom */}
      {type !== "audio" && (
        <div className="absolute bottom-4 z-10 px-3 py-1.5 rounded-full bg-black/50 text-white/70 text-[12px]">
          {name}
        </div>
      )}
    </div>,
    document.body,
  );
}
