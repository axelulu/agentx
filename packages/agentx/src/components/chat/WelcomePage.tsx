import { l10n } from "@agentx/l10n";
import {
  CodeIcon,
  BugIcon,
  FileTextIcon,
  RocketIcon,
  DatabaseIcon,
  ShieldIcon,
  PaletteIcon,
  GlobeIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Suggestion {
  icon: LucideIcon;
  title: string;
  prompt: string;
}

function getSuggestions(): Suggestion[] {
  return [
    {
      icon: CodeIcon,
      title: l10n.t("Refactor a function"),
      prompt: l10n.t("Help me refactor this function to be more readable and maintainable"),
    },
    {
      icon: BugIcon,
      title: l10n.t("Debug an error"),
      prompt: l10n.t("I'm getting an error in my code, help me find and fix the issue"),
    },
    {
      icon: FileTextIcon,
      title: l10n.t("Write documentation"),
      prompt: l10n.t("Help me write clear documentation for my project's API"),
    },
    {
      icon: RocketIcon,
      title: l10n.t("Set up CI/CD"),
      prompt: l10n.t("Help me set up a CI/CD pipeline with GitHub Actions for my project"),
    },
    {
      icon: DatabaseIcon,
      title: l10n.t("Design a schema"),
      prompt: l10n.t("Help me design a database schema for a new feature"),
    },
    {
      icon: PaletteIcon,
      title: l10n.t("Review UI code"),
      prompt: l10n.t(
        "Review my React component and suggest improvements for accessibility and performance",
      ),
    },
    {
      icon: GlobeIcon,
      title: l10n.t("Build an API"),
      prompt: l10n.t("Help me design and implement a RESTful API endpoint"),
    },
    {
      icon: ShieldIcon,
      title: l10n.t("Security audit"),
      prompt: l10n.t("Review my code for potential security vulnerabilities"),
    },
  ];
}

interface WelcomePageProps {
  onSelectPrompt: (prompt: string) => void;
}

export function WelcomePage({ onSelectPrompt }: WelcomePageProps) {
  const suggestions = getSuggestions();

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center overflow-y-auto px-8"
      style={{ scrollbarGutter: "stable" }}
    >
      <div className="max-w-3xl w-full space-y-10">
        {/* Heading */}
        <div className="text-center">
          <h2 className="text-2xl font-medium text-foreground/70 tracking-tight">
            {l10n.t("What can I help with?")}
          </h2>
        </div>

        {/* Suggestion grid */}
        <div className="grid grid-cols-4 gap-2">
          {suggestions.map((s) => (
            <button
              key={s.title}
              onClick={() => onSelectPrompt(s.prompt)}
              className="group flex flex-col gap-2.5 p-3.5 rounded-xl border border-border hover:border-border hover:bg-foreground/[0.02] transition-all text-left"
            >
              <s.icon className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground/60 transition-colors" />
              <span className="text-[12px] font-medium text-foreground/60 group-hover:text-foreground/80 leading-snug transition-colors">
                {s.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
