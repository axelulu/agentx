const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
  ".avif",
]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".ogg", ".mkv"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]);

export type PreviewType = "image" | "video" | "audio" | null;

export function getPreviewType(filePath: string): PreviewType {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = filePath.substring(dot).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  return null;
}

/**
 * Convert an absolute file path to a URL the renderer can load.
 * Uses the custom "local-file" protocol registered in the main process,
 * which proxies to file:// via net.fetch — works in both dev and prod.
 */
export function fileUrl(path: string): string {
  return "local-file://" + encodeURI(path);
}
