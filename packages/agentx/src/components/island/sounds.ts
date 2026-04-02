/**
 * 8-bit synthesized sound effects for the Dynamic Island.
 * Uses Web Audio API with square/triangle waves — no external audio files needed.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function isMuted(): boolean {
  return localStorage.getItem("agentx-island-muted") === "true";
}

function playNote(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.06,
  startTime = 0,
) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  gain.gain.setValueAtTime(volume, ctx.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration);
}

/** Short ascending beep — approval/allow */
export function playApprovalSound() {
  if (isMuted()) return;
  playNote(523.25, 0.08, "square", 0.05, 0); // C5
  playNote(659.25, 0.08, "square", 0.05, 0.07); // E5
  playNote(783.99, 0.12, "square", 0.05, 0.14); // G5
}

/** Celebratory arpeggio — agent completed */
export function playCompletionSound() {
  if (isMuted()) return;
  playNote(523.25, 0.06, "triangle", 0.04, 0); // C5
  playNote(659.25, 0.06, "triangle", 0.04, 0.05); // E5
  playNote(783.99, 0.06, "triangle", 0.04, 0.1); // G5
  playNote(1046.5, 0.15, "triangle", 0.04, 0.15); // C6
}

/** Descending buzz — error or deny */
export function playErrorSound() {
  if (isMuted()) return;
  playNote(440, 0.1, "square", 0.04, 0);
  playNote(330, 0.15, "square", 0.04, 0.1);
}

/** Single soft blip — new event notification */
export function playNotifySound() {
  if (isMuted()) return;
  playNote(880, 0.06, "triangle", 0.03, 0);
}
