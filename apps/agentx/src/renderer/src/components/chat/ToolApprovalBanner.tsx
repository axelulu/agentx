import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/slices/store";
import { clearPendingApproval } from "@/slices/chatSlice";
import { l10n } from "@workspace/l10n";
import {
  ShieldAlertIcon,
  CheckIcon,
  ShieldCheckIcon,
  XIcon,
  TerminalIcon,
  FileTextIcon,
  FilePenIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_ICONS: Record<string, React.ElementType> = {
  shell_run: TerminalIcon,
  file_read: FileTextIcon,
  file_create: FilePenIcon,
  file_rewrite: FilePenIcon,
};

const TOOL_LABEL_KEYS: Record<string, string> = {
  shell_run: "Run Shell Command",
  file_read: "Read File",
  file_create: "Create File",
  file_rewrite: "Rewrite File",
};

function formatArgs(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "shell_run":
      return String(args.command ?? "");
    case "file_read":
      return String(args.file_path ?? "");
    case "file_create":
    case "file_rewrite":
      return String(args.file_path ?? "");
    default:
      return JSON.stringify(args, null, 2);
  }
}

export function ToolApprovalBanner() {
  const dispatch = useDispatch();
  const pendingApproval = useSelector((state: RootState) => state.chat.pendingApproval);
  const currentConversationId = useSelector((state: RootState) => state.chat.currentConversationId);

  const handleRespond = useCallback(
    (approved: boolean) => {
      if (!pendingApproval || !currentConversationId) return;
      window.api.tool.respondApproval(currentConversationId, pendingApproval.approvalId, approved);
      dispatch(clearPendingApproval());
    },
    [pendingApproval, currentConversationId, dispatch],
  );

  const handleAlwaysAllow = useCallback(async () => {
    if (!pendingApproval || !currentConversationId) return;
    window.api.tool.respondApproval(currentConversationId, pendingApproval.approvalId, true);
    dispatch(clearPendingApproval());
    const permissions = await window.api.toolPermissions.get();
    await window.api.toolPermissions.set({ ...permissions, approvalMode: "auto" });
  }, [pendingApproval, currentConversationId, dispatch]);

  if (!pendingApproval) return null;

  const Icon = TOOL_ICONS[pendingApproval.toolName] ?? ShieldAlertIcon;
  const labelKey = TOOL_LABEL_KEYS[pendingApproval.toolName];
  const label = labelKey ? l10n.t(labelKey) : pendingApproval.toolName;
  const detail = formatArgs(pendingApproval.toolName, pendingApproval.arguments);

  return (
    <div className="mx-4 mb-3 animate-in slide-in-from-bottom-2 duration-200">
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-yellow-500/20">
          <ShieldAlertIcon className="w-4 h-4 text-yellow-500 shrink-0" />
          <span className="text-[12px] font-medium text-yellow-600 dark:text-yellow-400">
            {l10n.t("Permission Required")}
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-[13px] font-medium text-foreground">{label}</span>
          </div>

          {detail && (
            <div className="rounded-md bg-secondary/60 px-2.5 py-1.5 overflow-x-auto">
              <code className="text-[11px] text-foreground/80 whitespace-pre-wrap break-all font-mono">
                {detail.length > 300 ? detail.slice(0, 300) + "..." : detail}
              </code>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleRespond(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                "bg-emerald-600 text-white hover:bg-emerald-700",
              )}
            >
              <CheckIcon className="w-3 h-3" />
              {l10n.t("Allow")}
            </button>
            <button
              onClick={handleAlwaysAllow}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/30",
              )}
            >
              <ShieldCheckIcon className="w-3 h-3" />
              {l10n.t("Always Allow")}
            </button>
            <button
              onClick={() => handleRespond(false)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                "bg-foreground/10 text-foreground hover:bg-foreground/15",
              )}
            >
              <XIcon className="w-3 h-3" />
              {l10n.t("Deny")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
