import { getPreviewType, fileUrl } from "@/lib/filePreview";
import { Dialog, DialogContent } from "./Dialog";

interface FilePreviewDialogProps {
  path: string | null;
  onClose: () => void;
}

export function FilePreviewDialog({ path, onClose }: FilePreviewDialogProps) {
  const open = !!path;
  const type = path ? getPreviewType(path) : null;
  const url = path ? fileUrl(path) : "";
  const name = path ? (path.split("/").pop() ?? path) : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        maxWidth="4xl"
        showCloseButton
        className="bg-transparent border-none shadow-none p-0 gap-0"
        overlayStyle={{ backgroundColor: "rgba(0,0,0,0.15)" }}
      >
        <div className="flex flex-col items-center gap-3">
          {type === "image" && (
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          )}
          {type === "video" && (
            <video src={url} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg" />
          )}
          {type === "audio" && (
            <div className="bg-card border border-border rounded-xl p-6 min-w-[320px]">
              <p className="text-sm text-foreground mb-4 truncate">{name}</p>
              <audio src={url} controls autoPlay className="w-full" />
            </div>
          )}

          {/* File name label */}
          {type !== "audio" && name && (
            <div className="px-3 py-1.5 rounded-full bg-black/50 text-white/70 text-[12px]">
              {name}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
