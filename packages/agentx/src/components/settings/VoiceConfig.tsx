import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/slices/store";
import { setVoiceSettings } from "@/slices/settingsSlice";
import { l10n } from "@agentx/l10n";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";

const STT_LANGUAGES = [
  { value: "", label: () => l10n.t("Auto-detect") },
  { value: "en", label: () => "English" },
  { value: "zh", label: () => "Chinese" },
  { value: "de", label: () => "Deutsch" },
  { value: "es", label: () => "Español" },
  { value: "fr", label: () => "Français" },
  { value: "ja", label: () => "日本語" },
  { value: "ko", label: () => "한국어" },
  { value: "pt", label: () => "Português" },
  { value: "ru", label: () => "Русский" },
  { value: "ar", label: () => "العربية" },
];

export function VoiceConfig() {
  const dispatch = useDispatch<AppDispatch>();
  const voice = useSelector((s: RootState) => s.settings.voice);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const handleTest = () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(l10n.t("This is a test of the text to speech voice."));
    u.rate = voice.ttsRate;
    u.pitch = voice.ttsPitch;
    if (voice.ttsVoice) {
      const v = voices.find((v) => v.name === voice.ttsVoice);
      if (v) u.voice = v;
    }
    speechSynthesis.speak(u);
  };

  return (
    <div className="space-y-5">
      {/* STT section */}
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Speech to Text")}
        </label>

        {/* STT API URL */}
        <div className="space-y-1.5 py-2">
          <p className="text-sm text-foreground">{l10n.t("STT API URL")}</p>
          <p className="text-[12px] text-muted-foreground">
            {l10n.t("Whisper-compatible endpoint (e.g. OpenAI, Groq)")}
          </p>
          <input
            type="text"
            value={voice.sttApiUrl}
            onChange={(e) => dispatch(setVoiceSettings({ sttApiUrl: e.target.value }))}
            placeholder="https://api.groq.com/openai/v1"
            className="w-full bg-background border border-border/60 rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
        </div>

        {/* STT API Key */}
        <div className="space-y-1.5 py-2">
          <p className="text-sm text-foreground">{l10n.t("STT API Key")}</p>
          <input
            type="password"
            value={voice.sttApiKey}
            onChange={(e) => dispatch(setVoiceSettings({ sttApiKey: e.target.value }))}
            placeholder="sk-..."
            className="w-full bg-background border border-border/60 rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
        </div>

        {/* STT Language */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("STT Language")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Language hint for transcription")}
            </p>
          </div>
          <Select
            value={voice.sttLanguage}
            onChange={(v) => dispatch(setVoiceSettings({ sttLanguage: v }))}
            options={STT_LANGUAGES.map((lang) => ({ value: lang.value, label: lang.label() }))}
          />
        </div>
      </div>

      {/* TTS section */}
      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          {l10n.t("Text to Speech")}
        </label>

        {/* Voice selection */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Voice")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{l10n.t("Voice selection")}</p>
          </div>
          <Select
            value={voice.ttsVoice}
            onChange={(v) => dispatch(setVoiceSettings({ ttsVoice: v }))}
            options={[
              { value: "", label: l10n.t("System default") },
              ...voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` })),
            ]}
            className="max-w-[200px]"
          />
        </div>

        {/* Rate slider */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Rate")}</p>
          </div>
          <Slider
            value={voice.ttsRate}
            onChange={(v) => dispatch(setVoiceSettings({ ttsRate: v }))}
            min={0.5}
            max={2}
            step={0.1}
          />
        </div>

        {/* Pitch slider */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Pitch")}</p>
          </div>
          <Slider
            value={voice.ttsPitch}
            onChange={(v) => dispatch(setVoiceSettings({ ttsPitch: v }))}
            min={0.5}
            max={2}
            step={0.1}
          />
        </div>

        {/* Test button */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Test voice")}</p>
          </div>
          <button
            onClick={handleTest}
            className={cn(
              "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
              "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            {l10n.t("Test voice")}
          </button>
        </div>

        {/* Auto-read toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">{l10n.t("Auto-read replies")}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {l10n.t("Automatically read assistant responses aloud")}
            </p>
          </div>
          <button
            onClick={() => dispatch(setVoiceSettings({ autoReadReplies: !voice.autoReadReplies }))}
            className={cn(
              "relative w-9 h-5 rounded-full transition-colors",
              voice.autoReadReplies ? "bg-primary" : "bg-foreground/[0.12]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-primary-foreground transition-transform",
                voice.autoReadReplies && "translate-x-4",
              )}
            />
          </button>
        </div>

        {voices.length === 0 && (
          <p className="text-[11px] text-muted-foreground/60">
            {l10n.t("No TTS voices available on this system")}
          </p>
        )}
      </div>
    </div>
  );
}
