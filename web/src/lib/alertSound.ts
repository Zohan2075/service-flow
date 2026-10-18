// ─── Alert sounds (Web Audio, no assets) ─────────────────────────────────────
// Synthesized beeps for the Time tools (stopwatch / countdown) and the future
// global time widget. Dependency-free and safe to call from anywhere.

let audioContext: AudioContext | null = null;

/**
 * Plays a short three-pulse alert beep. Best-effort: silently no-ops when the
 * Web Audio API is unavailable or the context cannot start yet (autoplay
 * policy). Never throws.
 */
export function playAlertBeep(): void {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    // Starting a countdown happens on a user gesture, so the context is
    // normally unlocked; resume() covers reload / background cases.
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime + 0.02;
    const pulse = 0.18;
    const gap = 0.12;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, start);
    gain.gain.setValueAtTime(0.0001, start);
    for (let i = 0; i < 3; i++) {
      const pulseStart = start + i * (pulse + gap);
      gain.gain.exponentialRampToValueAtTime(0.06, pulseStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, pulseStart + pulse);
    }
    const stop = start + 3 * pulse + 2 * gap + 0.05;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(stop);
  } catch {
    // Audio is a progressive enhancement; never let it break the UI.
  }
}
