import type { ProviderConfig } from "@agentx/runtime";
import { readJsonFile } from "../stores";
import type { HandlerMap } from "./register-handlers";

export function registerVoiceHandlers(
  handlers: HandlerMap,
  prefsPath: string,
  providersPath: string,
): void {
  handlers["voice:transcribe"] = async (audioBase64: string, language?: string) => {
    try {
      const prefs = readJsonFile<Record<string, unknown>>(prefsPath, {});
      const voicePrefs = (prefs.voice ?? {}) as {
        sttApiUrl?: string;
        sttApiKey?: string;
      };

      let apiUrl: string;
      let apiKey: string;

      if (voicePrefs.sttApiUrl && voicePrefs.sttApiKey) {
        apiUrl = voicePrefs.sttApiUrl.replace(/\/+$/, "");
        apiKey = voicePrefs.sttApiKey;
      } else {
        const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
        const isDirectOpenAI = (p: ProviderConfig): boolean =>
          !!p.apiKey && (!p.baseUrl || p.baseUrl.includes("api.openai.com"));
        const provider =
          providers.find((p) => isDirectOpenAI(p)) ||
          providers.find((p) => !!p.apiKey && (p.type === "openai" || p.type === "custom"));
        if (!provider) {
          return { error: "No STT API configured." };
        }
        apiUrl = (provider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
        apiKey = provider.apiKey;
      }

      const fullUrl = `${apiUrl}/audio/transcriptions`;
      const audioBuf = Buffer.from(audioBase64, "base64");

      const boundary = `----FormBoundary${Date.now().toString(36)}`;
      const CRLF = "\r\n";
      const parts: Buffer[] = [];
      parts.push(
        Buffer.from(
          `--${boundary}${CRLF}Content-Disposition: form-data; name="model"${CRLF}${CRLF}whisper-1${CRLF}`,
        ),
      );
      if (language) {
        parts.push(
          Buffer.from(
            `--${boundary}${CRLF}Content-Disposition: form-data; name="language"${CRLF}${CRLF}${language}${CRLF}`,
          ),
        );
      }
      parts.push(
        Buffer.from(
          `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="recording.webm"${CRLF}Content-Type: audio/webm${CRLF}${CRLF}`,
        ),
      );
      parts.push(audioBuf);
      parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));
      const body = Buffer.concat(parts);

      const resp = await fetch(fullUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      const respText = await resp.text();
      if (resp.ok) {
        try {
          const json = JSON.parse(respText) as { text: string };
          return { text: json.text };
        } catch {
          return { error: "Invalid JSON response from Whisper API" };
        }
      } else {
        return { error: `Transcription failed (${resp.status})` };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Transcription failed" };
    }
  };
}
