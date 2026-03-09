import { useState, useCallback, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/slices/store";

interface UseTextToSpeechReturn {
  isSpeaking: boolean;
  speakingMessageId: string | null;
  speak: (text: string, messageId?: string) => void;
  stop: () => void;
  getVoices: () => SpeechSynthesisVoice[];
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const { ttsVoice, ttsRate, ttsPitch } = useSelector((s: RootState) => s.settings.voice);

  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = speechSynthesis.getVoices();
    };
    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string, messageId?: string) => {
      speechSynthesis.cancel();

      if (!text.trim()) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = ttsRate;
      utterance.pitch = ttsPitch;

      if (ttsVoice) {
        const voice = voicesRef.current.find((v) => v.name === ttsVoice);
        if (voice) utterance.voice = voice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingMessageId(messageId ?? null);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      };

      speechSynthesis.speak(utterance);
    },
    [ttsVoice, ttsRate, ttsPitch],
  );

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  }, []);

  const getVoices = useCallback(() => {
    return speechSynthesis.getVoices();
  }, []);

  return { isSpeaking, speakingMessageId, speak, stop, getVoices };
}
