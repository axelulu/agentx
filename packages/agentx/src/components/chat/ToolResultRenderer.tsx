import { memo, useMemo } from "react";
import { detectContentType } from "@/lib/toolResultDetectors";
import { DiffView } from "./DiffView";
import { FileTreeView } from "./FileTreeView";
import { ImagePathPreview } from "./ImagePathPreview";

interface ToolResultRendererProps {
  content: string;
  toolName?: string;
  isError?: boolean;
}

export const ToolResultRenderer = memo(function ToolResultRenderer({
  content,
  toolName,
  isError,
}: ToolResultRendererProps) {
  const contentType = useMemo(() => detectContentType(content, toolName), [content, toolName]);

  if (isError) {
    return <PlainResult content={content} />;
  }

  switch (contentType) {
    case "diff":
      return <DiffView content={content} />;
    case "filetree":
      return <FileTreeView content={content} />;
    case "image-paths":
      return (
        <>
          <ImagePathPreview content={content} />
          <PlainResult content={content} />
        </>
      );
    case "json":
      return <JsonResult content={content} />;
    case "code":
      return <CodeResult content={content} />;
    default:
      return <PlainResult content={content} />;
  }
});

function PlainResult({ content }: { content: string }) {
  return (
    <div className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
      {content}
    </div>
  );
}

function JsonResult({ content }: { content: string }) {
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    formatted = content;
  }
  return (
    <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
      <code className="hljs language-json">{formatted}</code>
    </pre>
  );
}

function CodeResult({ content }: { content: string }) {
  return (
    <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
      <code>{content}</code>
    </pre>
  );
}
