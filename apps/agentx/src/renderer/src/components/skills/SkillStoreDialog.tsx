import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import {
  addInstalledSkill,
  removeInstalledSkill,
  type SkillDefinition,
} from "@/slices/settingsSlice";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { l10n } from "@workspace/l10n";
import { SearchIcon, StarIcon, DownloadIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "All",
  "Coding",
  "Writing",
  "Analysis",
  "Productivity",
  "Creative",
  "Marketing",
  "Education",
];

interface SkillStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillStoreDialog({ open, onOpenChange }: SkillStoreDialogProps) {
  const dispatch = useDispatch<AppDispatch>();
  const installedSkills = useSelector((s: RootState) => s.settings.installedSkills);
  const installedIds = new Set(installedSkills.map((s) => s.id));

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [allResults, setAllResults] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasFetchedRef = useRef(false);

  // Fetch from API — only uses `query` (the REST `category` param is broken,
  // so we fetch more results and filter client-side by category name).
  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.skills.search(q, undefined, 60);
      setAllResults(res.skills as SkillDefinition[]);
    } catch (err) {
      console.error("[SkillStore] Search failed:", err);
      setError(err instanceof Error ? err.message : "Search failed");
      setAllResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open (once) and reset state on close
  useEffect(() => {
    if (open) {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        doSearch("");
      }
    } else {
      // Reset when dialog closes so next open is fresh
      hasFetchedRef.current = false;
    }
  }, [open, doSearch]);

  // Debounced search when query text changes
  useEffect(() => {
    if (!open) return;
    // Skip the initial render — the open effect already handles it
    if (!hasFetchedRef.current) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, doSearch]);

  // Client-side category filter on the fetched results
  const results = useMemo(() => {
    if (category === "All") return allResults;
    const lower = category.toLowerCase();
    return allResults.filter((s) => {
      // Match against the API's category name
      if (s.category.toLowerCase().includes(lower)) return true;
      // Also match against tags
      if (s.tags.some((t) => t.toLowerCase().includes(lower))) return true;
      return false;
    });
  }, [allResults, category]);

  const handleInstall = (skill: SkillDefinition) => {
    dispatch(addInstalledSkill(skill));
  };

  const handleUninstall = (id: string) => {
    dispatch(removeInstalledSkill(id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={l10n.t("Skill Store")}
        maxWidth="3xl"
        className="h-[min(600px,80vh)] flex flex-col"
      >
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={l10n.t("Search skills...")}
            className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-[12px] font-medium transition-colors",
                category === cat
                  ? "bg-foreground text-background"
                  : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
              )}
            >
              {l10n.t(cat)}
            </button>
          ))}
        </div>

        {/* Results grid */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && <div className="text-center py-8 text-[13px] text-destructive">{error}</div>}

          {!loading && !error && results.length === 0 && (
            <div className="text-center py-8 text-[13px] text-muted-foreground">
              {l10n.t("No skills match your search")}
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {results.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  installed={installedIds.has(skill.id)}
                  onInstall={handleInstall}
                  onUninstall={handleUninstall}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SkillCard({
  skill,
  installed,
  onInstall,
  onUninstall,
}: {
  skill: SkillDefinition;
  installed: boolean;
  onInstall: (s: SkillDefinition) => void;
  onUninstall: (id: string) => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-2 bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold text-foreground truncate">{skill.title}</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
            {skill.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <StarIcon className="w-3 h-3" />
          <span>{skill.voteCount}</span>
        </div>
        {skill.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        <div className="flex-1" />
        {installed ? (
          <button
            onClick={() => onUninstall(skill.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-foreground/5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <CheckIcon className="w-3 h-3" />
            {l10n.t("Installed")}
          </button>
        ) : (
          <button
            onClick={() => onInstall(skill)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            <DownloadIcon className="w-3 h-3" />
            {l10n.t("Install")}
          </button>
        )}
      </div>
    </div>
  );
}
