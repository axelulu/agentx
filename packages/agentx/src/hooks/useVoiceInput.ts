import { useState, useRef, useCallback, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/slices/store";

interface UseVoiceInputReturn {
  isRecording: boolean;
  recordingDuration: number;
  isTranscribing: boolean;
  error: string | null;
  toggleRecording: () => Promise<string | null>;
  cancelRecording: () => void;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sttLanguage = useSelector((s: RootState) => s.settings.voice.sttLanguage);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((text: string | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecordingDuration(0);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
      cleanup();
    }
  }, [cleanup]);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      setIsRecording(false);
      return null;
    }

    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          cleanup();

          if (blob.size === 0) {
            setIsTranscribing(false);
            resolve(null);
            return;
          }

          const buffer = await blob.arrayBuffer();
          const result = await window.api.voice.transcribe(buffer, sttLanguage || undefined);

          if ("error" in result) {
            setError(result.error);
            setIsTranscribing(false);
            resolve(null);
            return;
          }

          const text = result.text.trim();
          setIsTranscribing(false);
          resolve(text || null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
          setIsTranscribing(false);
          resolve(null);
        }
      };

      recorder.stop();
    });
  }, [sttLanguage, cleanup]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setIsRecording(false);
    setIsTranscribing(false);
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
  }, [cleanup]);

  const toggleRecording = useCallback(async (): Promise<string | null> => {
    if (isRecording) {
      return stopAndTranscribe();
    }
    await startRecording();
    return null;
  }, [isRecording, startRecording, stopAndTranscribe]);

  return {
    isRecording,
    recordingDuration,
    isTranscribing,
    error,
    toggleRecording,
    cancelRecording,
  };
}
