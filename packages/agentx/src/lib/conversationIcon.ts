import type { LucideIcon } from "lucide-react";
import {
  MessageSquareIcon,
  SendIcon,
  SmartphoneIcon,
  BugIcon,
  CodeIcon,
  PaletteIcon,
  SearchIcon,
  RocketIcon,
  WrenchIcon,
  DatabaseIcon,
  GlobeIcon,
  ShieldIcon,
  ZapIcon,
  FileTextIcon,
  BookOpenIcon,
  LightbulbIcon,
  LayersIcon,
} from "lucide-react";

const ICON_RULES: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ["telegram ·", "telegram:"], icon: SendIcon },
  { keywords: ["discord ·", "discord:"], icon: SmartphoneIcon },
  { keywords: ["bug", "fix", "error", "issue", "debug", "crash"], icon: BugIcon },
  {
    keywords: ["code", "function", "implement", "refactor", "class", "typescript", "javascript"],
    icon: CodeIcon,
  },
  { keywords: ["design", "ui", "style", "css", "layout", "color", "theme"], icon: PaletteIcon },
  { keywords: ["search", "find", "query", "lookup", "filter"], icon: SearchIcon },
  { keywords: ["deploy", "build", "release", "launch", "ship", "ci", "cd"], icon: RocketIcon },
  { keywords: ["config", "setup", "install", "tool", "setting"], icon: WrenchIcon },
  { keywords: ["data", "database", "sql", "schema", "migration", "table"], icon: DatabaseIcon },
  { keywords: ["api", "http", "endpoint", "request", "rest", "graphql", "web"], icon: GlobeIcon },
  { keywords: ["security", "auth", "password", "token", "permission"], icon: ShieldIcon },
  { keywords: ["performance", "optimize", "fast", "speed", "cache"], icon: ZapIcon },
  { keywords: ["doc", "readme", "write", "text", "markdown", "comment"], icon: FileTextIcon },
  { keywords: ["learn", "explain", "how", "what", "why", "tutorial", "guide"], icon: BookOpenIcon },
  { keywords: ["idea", "suggest", "plan", "think", "brainstorm"], icon: LightbulbIcon },
  { keywords: ["test", "spec", "assert", "coverage", "unit", "e2e"], icon: LayersIcon },
];

export function getConversationIcon(title: string): LucideIcon {
  const lower = title.toLowerCase();
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.icon;
    }
  }
  return MessageSquareIcon;
}
