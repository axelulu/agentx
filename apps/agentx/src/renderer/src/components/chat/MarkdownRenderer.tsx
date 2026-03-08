import { memo, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon, ChevronRightIcon, BrainIcon, LoaderIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------

function CodeBlock({
  className,
  children,
  node,
  ...props
}: ComponentPropsWithoutRef<"code"> & { inline?: boolean; node?: any }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className ?? "");
  const lang = match?.[1] ?? "";
  const code = String(children).replace(/\n$/, "");

  // Detect inline code: react-markdown wraps block code in <pre><code>, inline is just <code>
  const isBlock = node?.parentNode?.tagName === "pre" || !!className;
  if (!isBlock) {
    return (
      <code
        className="px-1.5 py-0.5 rounded-[4px] bg-foreground/[0.07] text-[12px] font-mono text-foreground/90"
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group/code relative rounded-lg overflow-hidden border border-foreground/[0.08] my-2.5">
      {/* Language label + copy button */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-foreground/[0.04] border-b border-foreground/[0.08]">
        <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="w-3 h-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <CopyIcon className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="px-3.5 py-3 overflow-x-auto text-[12px] leading-relaxed bg-foreground/[0.02]">
        <code className={cn("font-mono", className)} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// Pre wrapper — needed so react-markdown doesn't wrap our code block in an extra <pre>
function PreBlock({ children }: any) {
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Custom markdown components
// ---------------------------------------------------------------------------

const markdownComponents: Record<string, React.ComponentType<any>> = {
  code: CodeBlock,
  pre: PreBlock,

  // Headings
  h1: ({ children }: any) => (
    <h1 className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-base font-semibold text-foreground mt-3.5 mb-1.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[14px] font-semibold text-foreground mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="text-[13px] font-semibold text-foreground mt-2.5 mb-1 first:mt-0">{children}</h4>
  ),

  // Paragraphs
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,

  // Lists
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="text-foreground">{children}</li>,

  // Blockquote
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-foreground/20 pl-3 py-0.5 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),

  // Links
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary/80 transition-colors"
    >
      {children}
    </a>
  ),

  // Horizontal rule
  hr: () => <hr className="border-foreground/10 my-3" />,

  // Strong / em
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: any) => <em className="italic">{children}</em>,

  // Table
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-2.5 rounded-lg border border-foreground/[0.08]">
      <table className="w-full text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-foreground/[0.04]">{children}</thead>,
  tbody: ({ children }: any) => <tbody>{children}</tbody>,
  tr: ({ children }: any) => (
    <tr className="border-b border-foreground/[0.06] last:border-b-0">{children}</tr>
  ),
  th: ({ children }: any) => (
    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{children}</th>
  ),
  td: ({ children }: any) => <td className="px-3 py-1.5 text-foreground">{children}</td>,

  // Images
  img: ({ src, alt }: any) => (
    <img
      src={src}
      alt={alt ?? ""}
      className="max-w-full rounded-lg my-2 border border-foreground/[0.08]"
    />
  ),
};

// ---------------------------------------------------------------------------
// Thinking block component
// ---------------------------------------------------------------------------

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = content.trim();

  if (!trimmed) return null;

  // Build a short preview for the collapsed state
  const previewLine = trimmed.split("\n")[0].slice(0, 80);
  const preview =
    previewLine.length < trimmed.split("\n")[0].length ? previewLine + "..." : previewLine;

  return (
    <div className="mb-3 rounded-lg border border-foreground/[0.05] bg-foreground/[0.015] overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-foreground/[0.02] transition-colors"
      >
        {isStreaming ? (
          <LoaderIcon className="w-3.5 h-3.5 text-muted-foreground/40 animate-spin shrink-0" />
        ) : (
          <BrainIcon className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        )}
        <span className="text-[12px] text-muted-foreground/50 italic flex-1 min-w-0 truncate">
          {expanded ? "Thinking" : preview}
        </span>
        <ChevronRightIcon
          className={cn(
            "w-3 h-3 text-muted-foreground/30 shrink-0 transition-transform duration-150",
            expanded && "rotate-90",
          )}
        />
      </button>

      {/* Expandable thinking content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-foreground/[0.04]">
          <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground/50 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
            {trimmed}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parse thinking tags from content
// ---------------------------------------------------------------------------

interface ContentBlock {
  type: "thinking" | "text";
  content: string;
}

function parseContent(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  // Match <think>...</think>, <thinking>...</thinking>, or unclosed at end (streaming)
  const regex = /<think(?:ing)?>([\s\S]*?)(?:<\/think(?:ing)?>|$)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    // Text before the thinking block
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index);
      if (text.trim()) blocks.push({ type: "text", content: text });
    }
    // Thinking content
    const thinkContent = match[1];
    if (thinkContent.trim()) {
      blocks.push({ type: "thinking", content: thinkContent });
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last thinking block
  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex);
    if (text.trim()) blocks.push({ type: "text", content: text });
  }

  // No thinking blocks found — treat entire content as text
  if (blocks.length === 0 && raw.trim()) {
    blocks.push({ type: "text", content: raw });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// MarkdownRenderer — the main export
// ---------------------------------------------------------------------------

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Pass true while the message is still streaming (affects thinking block animation) */
  isStreaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  isStreaming,
}: MarkdownRendererProps) {
  const blocks = parseContent(content);

  // During streaming, if the last block is a thinking block, it's still in progress
  const lastBlockIsThinking = blocks.length > 0 && blocks[blocks.length - 1].type === "thinking";

  return (
    <div className={cn("text-[13px] leading-relaxed text-foreground", className)}>
      {blocks.map((block, i) =>
        block.type === "thinking" ? (
          <ThinkingBlock
            key={i}
            content={block.content}
            isStreaming={isStreaming && lastBlockIsThinking && i === blocks.length - 1}
          />
        ) : (
          <div key={i} className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {block.content}
            </ReactMarkdown>
          </div>
        ),
      )}
    </div>
  );
});
