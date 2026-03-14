import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { FolderIcon, FolderOpenIcon, FileIcon, ChevronRightIcon } from "lucide-react";

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
}

/** Parse flat path lines into a nested tree structure. */
function buildTree(lines: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  // Strip tree-drawing chars and clean up each line
  const paths = lines
    .map((l) => l.replace(/[│├└──\s]+/g, " ").trim())
    .filter((l) => l && !l.startsWith("#"));

  for (const raw of paths) {
    const parts = raw.split("/").filter(Boolean);
    let current = root;
    let fullPath = "";

    for (let i = 0; i < parts.length; i++) {
      fullPath += (fullPath ? "/" : "") + parts[i];
      const isLast = i === parts.length - 1;
      const isDir = !isLast || raw.endsWith("/");

      let node = current.find((n) => n.name === parts[i]);
      if (!node) {
        node = { name: parts[i], fullPath, isDir, children: [] };
        current.push(node);
      }
      if (!isLast) {
        node.isDir = true;
      }
      current = node.children;
    }
  }

  return root;
}

function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const handleClick = useCallback(() => {
    if (node.isDir) {
      setExpanded((e) => !e);
    } else {
      window.api.fs.showItemInFolder(node.fullPath).catch(() => {});
    }
  }, [node]);

  const DirIcon = expanded ? FolderOpenIcon : FolderIcon;

  return (
    <>
      <div
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer hover:bg-foreground/[0.04] text-[11px]",
          node.isDir ? "text-foreground/80" : "text-muted-foreground/80 hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {node.isDir && (
          <ChevronRightIcon
            className={cn(
              "w-3 h-3 shrink-0 transition-transform duration-100",
              expanded && "rotate-90",
            )}
          />
        )}
        {node.isDir ? (
          <DirIcon className="w-3.5 h-3.5 shrink-0 text-amber-500/70" />
        ) : (
          <FileIcon className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {node.isDir &&
        expanded &&
        node.children.map((child) => (
          <TreeNodeRow key={child.fullPath} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

export const FileTreeView = memo(function FileTreeView({ content }: { content: string }) {
  const lines = content.split("\n").filter((l) => l.trim());
  const tree = buildTree(lines);

  return (
    <div className="font-mono overflow-x-auto py-1">
      {tree.map((node) => (
        <TreeNodeRow key={node.fullPath} node={node} depth={0} />
      ))}
    </div>
  );
});
