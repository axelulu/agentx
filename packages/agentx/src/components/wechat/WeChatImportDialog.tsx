import { useState, useCallback, useMemo } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/slices/store";
import { createNewConversation, addUserMessage } from "@/slices/chatSlice";
import { openTab, setActiveView } from "@/slices/uiSlice";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import {
  detectAndParse,
  extractParticipants,
  buildRoleplaySystemPrompt,
  mergeParsedChats,
  type ParsedChat,
  type ParticipantInfo,
} from "@/lib/wechatParser";
import {
  MessageCircleIcon,
  FileUpIcon,
  ClipboardPasteIcon,
  FolderOpenIcon,
  ChevronLeftIcon,
  Loader2Icon,
  UploadCloudIcon,
  UserIcon,
  ArrowRightIcon,
} from "lucide-react";

interface WeChatImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "import" | "select" | "confirm";
type ImportTab = "file" | "folder" | "paste";

const STEP_INDEX: Record<Step, number> = { import: 0, select: 1, confirm: 2 };

export function WeChatImportDialog({ open, onOpenChange }: WeChatImportDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const [step, setStep] = useState<Step>("import");
  const [activeTab, setActiveTab] = useState<ImportTab>("file");
  const [pasteText, setPasteText] = useState("");
  const [parsedChat, setParsedChat] = useState<ParsedChat | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setStep("import");
    setActiveTab("file");
    setPasteText("");
    setParsedChat(null);
    setParticipants([]);
    setSelectedPerson("");
    setTitle("");
    setLoading(false);
    setError("");
  }, []);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset],
  );

  const handleParsed = useCallback((parsed: ParsedChat) => {
    if (parsed.messages.length === 0) {
      setError(l10n.t("No messages found. Please check the format."));
      return;
    }
    setParsedChat(parsed);
    const parts = extractParticipants(parsed);
    setParticipants(parts);
    setError("");
    setStep("select");
  }, []);

  const handleFileImport = useCallback(async () => {
    try {
      const result = await window.api.fs.selectFile({
        filters: [{ name: "Chat Export", extensions: ["txt", "html", "htm"] }],
      });
      if (!result) return;
      const path = Array.isArray(result) ? result[0] : result;
      if (!path) return;
      const content = (await window.api.fs.readFile(path)) as string;
      handleParsed(detectAndParse(content));
    } catch {
      setError(l10n.t("Failed to read file."));
    }
  }, [handleParsed]);

  const handleFolderImport = useCallback(async () => {
    try {
      const dirPath = await window.api.fs.selectDirectory();
      if (!dirPath) return;
      setLoading(true);
      setError("");
      const entries = await window.api.fs.listDir(dirPath);
      const chatFiles = entries.filter((f) => /\.(txt|html|htm)$/i.test(f));
      if (chatFiles.length === 0) {
        setError(l10n.t("No .txt or .html files found in the selected folder."));
        setLoading(false);
        return;
      }
      const parsed: ParsedChat[] = [];
      for (const filePath of chatFiles) {
        try {
          const content = (await window.api.fs.readFile(filePath)) as string;
          const result = detectAndParse(content);
          if (result.messages.length > 0) parsed.push(result);
        } catch {
          // skip unreadable files
        }
      }
      setLoading(false);
      if (parsed.length === 0) {
        setError(l10n.t("No messages found in any file. Please check the format."));
        return;
      }
      handleParsed(mergeParsedChats(parsed));
    } catch {
      setError(l10n.t("Failed to read folder."));
      setLoading(false);
    }
  }, [handleParsed]);

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    handleParsed(detectAndParse(pasteText));
  }, [pasteText, handleParsed]);

  const handleSelectPerson = useCallback((name: string) => {
    setSelectedPerson(name);
    setTitle(`WeChat: ${name}`);
    setStep("confirm");
  }, []);

  const handleCreate = useCallback(async () => {
    if (!parsedChat || !selectedPerson) return;
    setLoading(true);
    try {
      const conv = await dispatch(createNewConversation(title)).unwrap();
      dispatch(openTab(conv.id));
      dispatch(setActiveView("chat"));
      await window.api.conversation.setSystemPrompt(
        conv.id,
        buildRoleplaySystemPrompt(parsedChat, selectedPerson),
      );
      const greeting = `你好！`;
      dispatch(addUserMessage({ conversationId: conv.id, content: greeting }));
      await window.api.agent.send(conv.id, greeting);
      await window.api.agent.subscribe(conv.id);
      handleOpenChange(false);
    } catch {
      setError(l10n.t("Failed to create conversation."));
      setLoading(false);
    }
  }, [dispatch, parsedChat, selectedPerson, title, handleOpenChange]);

  const selectedParticipant = useMemo(
    () => participants.find((p) => p.name === selectedPerson),
    [participants, selectedPerson],
  );

  const currentStepIndex = STEP_INDEX[step];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} maxWidth="2xl" className="p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          {step !== "import" ? (
            <button
              onClick={() => setStep(step === "confirm" ? "select" : "import")}
              className="p-0.5 -ml-1 rounded-md hover:bg-foreground/[0.06] transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : (
            <MessageCircleIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="flex-1 text-sm font-medium text-foreground">
            {l10n.t("WeChat Roleplay")}
          </span>
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentStepIndex
                    ? "w-4 bg-primary"
                    : i < currentStepIndex
                      ? "w-1.5 bg-primary/40"
                      : "w-1.5 bg-foreground/10",
                )}
              />
            ))}
          </div>
        </div>

        {/* ── Step 1: Import ── */}
        {step === "import" && (
          <div className="flex flex-col">
            {/* Pill tabs */}
            <div className="flex gap-1 px-5 pt-4 pb-2">
              <button
                onClick={() => setActiveTab("file")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeTab === "file"
                    ? "bg-foreground/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
                )}
              >
                <FileUpIcon className="w-3 h-3" />
                {l10n.t("Import File")}
              </button>
              <button
                onClick={() => setActiveTab("folder")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeTab === "folder"
                    ? "bg-foreground/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
                )}
              >
                <FolderOpenIcon className="w-3 h-3" />
                {l10n.t("Import Folder")}
              </button>
              <button
                onClick={() => setActiveTab("paste")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  activeTab === "paste"
                    ? "bg-foreground/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
                )}
              >
                <ClipboardPasteIcon className="w-3 h-3" />
                {l10n.t("Paste Text")}
              </button>
            </div>

            {activeTab === "file" && (
              <div className="px-5 pb-5 pt-2">
                <button
                  onClick={handleFileImport}
                  className="group w-full flex flex-col items-center justify-center gap-3 py-10 rounded-xl border border-dashed border-foreground/10 hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all cursor-pointer"
                >
                  <div className="p-3 rounded-xl bg-foreground/[0.04] group-hover:bg-foreground/[0.07] transition-colors">
                    <UploadCloudIcon className="w-6 h-6 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground transition-colors">
                      {l10n.t("Choose a file")}
                    </span>
                    <span className="text-[11px] text-muted-foreground/50">.txt, .html, .htm</span>
                  </div>
                </button>
              </div>
            )}

            {activeTab === "folder" && (
              <div className="px-5 pb-5 pt-2">
                <button
                  onClick={handleFolderImport}
                  disabled={loading}
                  className="group w-full flex flex-col items-center justify-center gap-3 py-10 rounded-xl border border-dashed border-foreground/10 hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                >
                  {loading ? (
                    <div className="p-3 rounded-xl bg-foreground/[0.04]">
                      <Loader2Icon className="w-6 h-6 text-muted-foreground/60 animate-spin" />
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-foreground/[0.04] group-hover:bg-foreground/[0.07] transition-colors">
                      <FolderOpenIcon className="w-6 h-6 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground transition-colors">
                      {loading ? l10n.t("Reading files...") : l10n.t("Choose a folder")}
                    </span>
                    <span className="text-[11px] text-muted-foreground/50">
                      {l10n.t("All .txt and .html files will be merged")}
                    </span>
                  </div>
                </button>
              </div>
            )}

            {activeTab === "paste" && (
              <div className="flex flex-col gap-3 px-5 pb-5 pt-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={l10n.t("Paste WeChat chat history here...")}
                  className="w-full h-44 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3.5 text-[13px] leading-relaxed resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/20 transition-colors font-mono"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handlePaste}
                    disabled={!pasteText.trim()}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                      pasteText.trim()
                        ? "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                        : "bg-foreground/[0.06] text-muted-foreground/40 cursor-not-allowed",
                    )}
                  >
                    {l10n.t("Parse")}
                    <ArrowRightIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="px-5 pb-4 -mt-1">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Select Person ── */}
        {step === "select" && parsedChat && (
          <div className="flex flex-col">
            {/* Stats bar */}
            <div className="flex items-center gap-2 px-5 py-3">
              <span className="text-[11px] text-muted-foreground/60">
                {l10n.t("${count} messages", { count: parsedChat.messages.length })}
              </span>
              <span className="text-muted-foreground/20">·</span>
              <span className="text-[11px] text-muted-foreground/60">
                {l10n.t("${count} participants", { count: participants.length })}
              </span>
            </div>

            {/* Participant list */}
            <div className="flex flex-col gap-1 px-3 pb-4 max-h-[340px] overflow-y-auto">
              {participants.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleSelectPerson(p.name)}
                  className="group flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-foreground/[0.04] transition-all"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold mt-0.5 bg-foreground/[0.06] text-muted-foreground">
                    {p.name[0]}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
                        {p.messageCount}
                      </span>
                    </div>
                    {p.sampleMessages.length > 0 && (
                      <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5 leading-relaxed">
                        {p.sampleMessages[0]}
                      </p>
                    )}
                  </div>
                  {/* Arrow */}
                  <ArrowRightIcon className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all shrink-0 mt-1.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === "confirm" && selectedParticipant && (
          <div className="flex flex-col">
            {/* Selected person card */}
            <div className="mx-5 mt-4 p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-foreground/[0.06] text-muted-foreground">
                  {selectedPerson[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{selectedPerson}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    {l10n.t("${count} messages", { count: selectedParticipant.messageCount })}
                    {" · "}
                    {l10n.t("AI will mimic this person's style")}
                  </p>
                </div>
              </div>
            </div>

            {/* Title input */}
            <div className="flex flex-col gap-1.5 px-5 pt-4">
              <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                {l10n.t("Title")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-sm focus:outline-none focus:border-foreground/20 transition-colors"
              />
            </div>

            {/* Action */}
            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button
                onClick={handleCreate}
                disabled={loading || !title.trim()}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  loading || !title.trim()
                    ? "bg-foreground/[0.06] text-muted-foreground/40 cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer active:scale-[0.98]",
                )}
              >
                {loading && <Loader2Icon className="w-3 h-3 animate-spin" />}
                {l10n.t("Start Chat")}
              </button>
            </div>

            {error && (
              <div className="px-5 pb-4 -mt-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer hint ── */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-border text-[11px] text-muted-foreground/40">
          <div className="flex items-center gap-1">
            <UserIcon className="w-3 h-3" />
            <span>
              {step === "import"
                ? l10n.t("Import a chat to begin")
                : step === "select"
                  ? l10n.t("Choose who to roleplay as")
                  : l10n.t("Ready to start")}
            </span>
          </div>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-foreground/[0.06] text-[10px]">esc</kbd>{" "}
            {l10n.t("close")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
