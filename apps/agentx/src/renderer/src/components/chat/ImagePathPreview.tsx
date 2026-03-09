import { memo, useState } from "react";
import { fileUrl } from "@/lib/filePreview";
import { FilePreviewDialog } from "@/components/ui/FilePreviewDialog";

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$/i;

function extractImagePaths(content: string): string[] {
  const paths: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Match absolute paths or relative paths with image extensions
    if (IMAGE_EXT_RE.test(trimmed)) {
      // Strip common prefixes like "- ", "* ", list markers
      const cleaned = trimmed.replace(/^[-*•]\s+/, "");
      if (cleaned.startsWith("/") || cleaned.startsWith("~")) {
        paths.push(cleaned);
      }
    }
  }
  return paths;
}

export const ImagePathPreview = memo(function ImagePathPreview({ content }: { content: string }) {
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const paths = extractImagePaths(content);

  if (paths.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 py-1">
        {paths.map((p) => (
          <button
            key={p}
            onClick={() => setPreviewPath(p)}
            className="relative w-24 h-24 rounded-md overflow-hidden border border-foreground/[0.08] hover:border-foreground/20 transition-colors bg-foreground/[0.02]"
            title={p}
          >
            <img
              src={fileUrl(p)}
              alt={p.split("/").pop() ?? ""}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </button>
        ))}
      </div>
      <FilePreviewDialog path={previewPath} onClose={() => setPreviewPath(null)} />
    </>
  );
});
