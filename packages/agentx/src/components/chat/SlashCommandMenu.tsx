import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { createNewConversation } from "@/slices/chatSlice";
import { openTab, openSettingsSection, setWeChatImportOpen } from "@/slices/uiSlice";
import { toggleSkill } from "@/slices/chatSlice";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import {
  ZapIcon,
  PlusCircleIcon,
  SettingsIcon,
  MicIcon,
  BookOpenIcon,
  PlugIcon,
  FileIcon,
  FolderIcon,
  CameraIcon,
  ScanTextIcon,
  ScrollTextIcon,
  MessageCircleIcon,
  type LucideIcon,
} from "lucide-react";

interface SlashCommand {
  id: string;
  icon: LucideIcon;
  label: string;
  keywords?: string[];
  action: () => void;
}

export interface SlashCommandActions {
  onAttachFiles: () => void;
  onAttachFolder: () => void;
  onScreenCapture: () => void;
  onOcrCapture: () => void;
  onMic: () => void;
  onSystemPrompt: () => void;
}

interface SlashCommandMenuProps {
  inputValue: string;
  onClearInput: () => void;
  onClose: () => void;
  onConsumeEnter: (handler: (() => void) | null) => void;
  actions: SlashCommandActions;
}

export function SlashCommandMenu({
  inputValue,
  onClearInput,
  onClose,
  onConsumeEnter,
  actions,
}: SlashCommandMenuProps) {
  const dispatch = useDispatch<AppDispatch>();
  const installedSkills = useSelector((s: RootState) => s.settings.installedSkills);
  const enabledSkills = useSelector((s: RootState) => s.chat.enabledSkills);
  const currentConversationId = useSelector((s: RootState) => s.chat.currentConversationId);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const isActive = inputValue.startsWith("/");
  const query = isActive ? inputValue.slice(1).toLowerCase() : "";

  const builtinCommands = useMemo<SlashCommand[]>(
    () => [
      {
        id: "cmd:new",
        icon: PlusCircleIcon,
        label: l10n.t("New Chat"),
        keywords: ["new", "chat", "conversation", "create"],
        action: () => {
          dispatch(createNewConversation()).then((r) => {
            if (r.meta.requestStatus === "fulfilled") {
              dispatch(openTab((r.payload as { id: string }).id));
            }
          });
        },
      },
      {
        id: "cmd:attach-files",
        icon: FileIcon,
        label: l10n.t("Attach Files"),
        keywords: ["attach", "file", "upload", "add"],
        action: actions.onAttachFiles,
      },
      {
        id: "cmd:attach-folder",
        icon: FolderIcon,
        label: l10n.t("Attach Folder"),
        keywords: ["attach", "folder", "directory"],
        action: actions.onAttachFolder,
      },
      {
        id: "cmd:screenshot",
        icon: CameraIcon,
        label: l10n.t("Screenshot"),
        keywords: ["screenshot", "capture", "screen", "image"],
        action: actions.onScreenCapture,
      },
      {
        id: "cmd:ocr",
        icon: ScanTextIcon,
        label: l10n.t("Screen OCR"),
        keywords: ["ocr", "scan", "text", "recognize"],
        action: actions.onOcrCapture,
      },
      {
        id: "cmd:voice",
        icon: MicIcon,
        label: l10n.t("Voice Input"),
        keywords: ["voice", "mic", "record", "speech"],
        action: actions.onMic,
      },
      {
        id: "cmd:prompt",
        icon: ScrollTextIcon,
        label: l10n.t("System Prompt"),
        keywords: ["prompt", "system", "instruction"],
        action: actions.onSystemPrompt,
      },
      {
        id: "cmd:settings",
        icon: SettingsIcon,
        label: l10n.t("Settings"),
        keywords: ["settings", "preferences", "config"],
        action: () => dispatch(openSettingsSection("providers")),
      },
      {
        id: "cmd:knowledge",
        icon: BookOpenIcon,
        label: l10n.t("Knowledge Base"),
        keywords: ["knowledge", "kb", "rag", "docs"],
        action: () => dispatch(openSettingsSection("knowledgeBase")),
      },
      {
        id: "cmd:mcp",
        icon: PlugIcon,
        label: l10n.t("MCP Servers"),
        keywords: ["mcp", "server", "plugin", "tools"],
        action: () => dispatch(openSettingsSection("mcp")),
      },
      {
        id: "cmd:wechat",
        icon: MessageCircleIcon,
        label: l10n.t("WeChat Roleplay"),
        keywords: ["wechat", "roleplay", "chat", "simulate", "微信", "角色扮演"],
        action: () => dispatch(setWeChatImportOpen(true)),
      },
    ],
    [dispatch, actions],
  );

  const skillCommands = useMemo<SlashCommand[]>(
    () =>
      installedSkills.map((skill) => ({
        id: `skill:${skill.id}`,
        icon: ZapIcon,
        label: skill.title,
        keywords: [...skill.tags, skill.category],
        action: () => {
          if (!enabledSkills.includes(skill.id)) {
            dispatch(toggleSkill(skill.id));
            if (currentConversationId) {
              window.api.skills
                .setEnabled(currentConversationId, [...enabledSkills, skill.id])
                .catch(console.error);
            }
          }
        },
      })),
    [installedSkills, enabledSkills, currentConversationId, dispatch],
  );

  const items = useMemo(() => {
    const all = [...builtinCommands, ...skillCommands];
    if (!query) return all;
    return all.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(query)),
    );
  }, [builtinCommands, skillCommands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length, query]);

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const executeSelected = useCallback(() => {
    const cmd = items[selectedIndex];
    if (!cmd) return;
    cmd.action();
    onClearInput();
    onClose();
  }, [items, selectedIndex, onClearInput, onClose]);

  useEffect(() => {
    if (isActive && items.length > 0) {
      onConsumeEnter(() => executeSelected());
    } else {
      onConsumeEnter(null);
    }
    return () => onConsumeEnter(null);
  }, [isActive, items.length, executeSelected, onConsumeEnter]);

  useEffect(() => {
    if (!isActive || items.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClearInput();
        onClose();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isActive, items.length, onClearInput, onClose]);

  if (!isActive || items.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-20">
      <div className="bg-popover border border-border rounded-lg shadow-md overflow-hidden">
        <div ref={listRef} className="max-h-[240px] overflow-y-auto py-1">
          {items.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => {
                  cmd.action();
                  onClearInput();
                  onClose();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground/80 transition-colors",
                  i === selectedIndex ? "bg-foreground/[0.06] text-foreground" : "",
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{cmd.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
