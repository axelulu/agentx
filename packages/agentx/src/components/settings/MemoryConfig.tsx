import { useEffect, useState, useCallback } from "react";
import { l10n } from "@agentx/l10n";
import {
  Trash2Icon,
  PencilIcon,
  CheckIcon,
  XIcon,
  BrainIcon,
  SparklesIcon,
  BookOpenIcon,
  LightbulbIcon,
  CodeIcon,
  MessageSquareIcon,
  WrenchIcon,
} from "lucide-react";
import { ToggleSwitch } from "./SettingsAccordion";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  preference: {
    icon: SparklesIcon,
    color: "text-foreground/70",
    bg: "bg-foreground/[0.04]",
  },
  project: {
    icon: CodeIcon,
    color: "text-foreground/70",
    bg: "bg-foreground/[0.04]",
  },
  pattern: {
    icon: LightbulbIcon,
    color: "text-foreground/70",
    bg: "bg-foreground/[0.04]",
  },
  instruction: {
    icon: WrenchIcon,
    color: "text-foreground/70",
    bg: "bg-foreground/[0.04]",
  },
};

export function MemoryConfig() {
  const [config, setConfig] = useState<MemoryConfig>({
    enabled: true,
    maxSummaries: 50,
    maxFacts: 100,
    autoExtract: true,
  });
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [facts, setFacts] = useState<LearnedFact[]>([]);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [activeTab, setActiveTab] = useState<"facts" | "summaries">("facts");

  const loadData = useCallback(async () => {
    const [cfg, sums, fcts] = await Promise.all([
      window.api.memory.getConfig(),
      window.api.memory.getSummaries(),
      window.api.memory.getFacts(),
    ]);
    setConfig(cfg);
    setSummaries(sums);
    setFacts(fcts);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateConfig = async (patch: Partial<MemoryConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    await window.api.memory.setConfig(next);
  };

  const deleteSummary = async (id: string) => {
    await window.api.memory.deleteSummary(id);
    setSummaries((prev) => prev.filter((s) => s.id !== id));
  };

  const deleteFact = async (id: string) => {
    await window.api.memory.deleteFact(id);
    setFacts((prev) => prev.filter((f) => f.id !== id));
  };

  const startEditFact = (fact: LearnedFact) => {
    setEditingFactId(fact.id);
    setEditContent(fact.content);
  };

  const saveEditFact = async () => {
    if (!editingFactId) return;
    const updated = await window.api.memory.updateFact(editingFactId, editContent);
    if (updated) {
      setFacts((prev) => prev.map((f) => (f.id === editingFactId ? updated : f)));
    }
    setEditingFactId(null);
  };

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "preference":
        return l10n.t("Preference");
      case "project":
        return l10n.t("Project");
      case "pattern":
        return l10n.t("Pattern");
      case "instruction":
        return l10n.t("Instruction");
      default:
        return cat;
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Hero card — enable/disable + stats */}
      <div className="rounded-xl bg-gradient-to-br from-foreground/[0.01] to-foreground/[0.03] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-lg bg-foreground/[0.04] flex items-center justify-center shrink-0">
              <BrainIcon className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">{l10n.t("Enable Memory")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {l10n.t("Allow agent to remember across conversations")}
              </p>
            </div>
          </div>
          <ToggleSwitch checked={config.enabled} onChange={(v) => updateConfig({ enabled: v })} />
        </div>

        {config.enabled && (
          <div className="mt-4 flex gap-3">
            <StatPill
              label={l10n.t("Facts")}
              value={facts.length}
              max={config.maxFacts}
              accent="text-foreground/70"
            />
            <StatPill
              label={l10n.t("Summaries")}
              value={summaries.length}
              max={config.maxSummaries}
              accent="text-foreground/70"
            />
            <div className="flex-1 flex items-center justify-end">
              <label className="flex items-center gap-2 cursor-pointer group/ae">
                <ToggleSwitch
                  checked={config.autoExtract}
                  onChange={(v) => updateConfig({ autoExtract: v })}
                />
                <span className="text-[11px] text-muted-foreground group-hover/ae:text-foreground transition-colors select-none">
                  {l10n.t("Auto Extract")}
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Content — tabs */}
      {config.enabled && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-0.5">
            <TabButton
              active={activeTab === "facts"}
              onClick={() => setActiveTab("facts")}
              icon={LightbulbIcon}
              label={l10n.t("Learned Facts")}
              count={facts.length}
            />
            <TabButton
              active={activeTab === "summaries"}
              onClick={() => setActiveTab("summaries")}
              icon={BookOpenIcon}
              label={l10n.t("Conversation Summaries")}
              count={summaries.length}
            />
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 rounded-lg bg-foreground/[0.02] overflow-y-auto">
            {activeTab === "facts" && (
              <div className="divide-y divide-border/40">
                {facts.length === 0 ? (
                  <EmptyState
                    icon={LightbulbIcon}
                    message={l10n.t(
                      "No learned facts yet. They will be extracted automatically from your conversations.",
                    )}
                  />
                ) : (
                  facts.map((fact) => {
                    const meta = CATEGORY_META[fact.category] ?? CATEGORY_META.preference!;
                    const CatIcon = meta.icon;
                    return (
                      <div
                        key={fact.id}
                        className="group flex items-start gap-2.5 px-3 py-2.5 hover:bg-foreground/[0.03] transition-colors"
                      >
                        {/* Category icon */}
                        <div
                          className={cn(
                            "mt-px w-5 h-5 rounded flex items-center justify-center shrink-0",
                            meta.bg,
                          )}
                        >
                          <CatIcon className={cn("w-3 h-3", meta.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {editingFactId === fact.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditFact();
                                  if (e.key === "Escape") setEditingFactId(null);
                                }}
                                className="flex-1 text-[12px] bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                                autoFocus
                              />
                              <button
                                onClick={saveEditFact}
                                className="p-1.5 rounded-md text-foreground hover:bg-foreground/[0.06] transition-colors"
                              >
                                <CheckIcon className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingFactId(null)}
                                className="p-1.5 rounded-md text-muted-foreground hover:bg-foreground/[0.03] transition-colors"
                              >
                                <XIcon className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="text-[12px] text-foreground/90 leading-relaxed">
                                {fact.content}
                              </p>
                              <span
                                className={cn(
                                  "inline-block mt-1 text-[10px] font-medium px-1.5 py-px rounded-full",
                                  meta.bg,
                                  meta.color,
                                )}
                              >
                                {categoryLabel(fact.category)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        {editingFactId !== fact.id && (
                          <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEditFact(fact)}
                              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.03] transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteFact(fact.id)}
                              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2Icon className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "summaries" && (
              <div className="divide-y divide-border/40">
                {summaries.length === 0 ? (
                  <EmptyState
                    icon={BookOpenIcon}
                    message={l10n.t(
                      "No conversation summaries yet. They will be generated after each conversation.",
                    )}
                  />
                ) : (
                  [...summaries].reverse().map((summary) => (
                    <div
                      key={summary.id}
                      className="group flex items-start gap-2.5 px-3 py-2.5 hover:bg-foreground/[0.03] transition-colors"
                    >
                      {/* Icon */}
                      <div className="mt-px w-5 h-5 rounded bg-foreground/[0.04] flex items-center justify-center shrink-0">
                        <MessageSquareIcon className="w-3 h-3 text-muted-foreground" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p className="text-[12px] font-medium text-foreground truncate">
                            {summary.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                            {new Date(summary.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                          {summary.summary}
                        </p>
                        {summary.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {summary.topics.map((topic, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-1.5 py-px rounded-full bg-foreground/[0.04] text-muted-foreground/70"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => deleteSummary(summary.id)}
                        className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2Icon className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disabled state */}
      {!config.enabled && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
          <BrainIcon className="w-8 h-8 mb-2" />
          <p className="text-[12px]">
            {l10n.t("Enable memory to let the agent learn from your conversations")}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatPill({
  label,
  value,
  max,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  accent: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-foreground/[0.04] px-3 py-1.5">
      <div className="flex flex-col items-start">
        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider leading-none">
          {label}
        </span>
        <span className="text-[15px] font-semibold text-foreground leading-tight mt-0.5 tabular-nums">
          {value}
        </span>
      </div>
      {/* Tiny progress ring */}
      <svg className="w-5 h-5 -rotate-90 shrink-0" viewBox="0 0 20 20">
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-foreground/[0.06]"
        />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={`${pct * 0.5} 50`}
          strokeLinecap="round"
          className={accent}
        />
      </svg>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
        active
          ? "bg-foreground/[0.05] text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span
        className={cn(
          "ml-0.5 text-[10px] tabular-nums px-1.5 py-px rounded-full",
          active
            ? "bg-foreground/[0.06] text-foreground/70"
            : "bg-foreground/[0.04] text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-10 h-10 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-muted-foreground/30" />
      </div>
      <p className="text-[12px] text-muted-foreground/50 max-w-[260px] leading-relaxed">
        {message}
      </p>
    </div>
  );
}
