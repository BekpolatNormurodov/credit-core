/**
 * Notification sound — a short, soft "ping" played when new unread arrives.
 * Per-user preference lives in localStorage (default ON). Uses the Web Audio API
 * so there's no asset to ship; the first ping may be silent until the user has
 * interacted with the page (browser autoplay policy), which is expected.
 */
const KEY = 'cc.sound';

export const soundEnabled = (): boolean => localStorage.getItem(KEY) !== '0';
export const setSoundEnabled = (on: boolean): void => localStorage.setItem(KEY, on ? '1' : '0');

let ctx: AudioContext | null = null;

export function playPing(): void {
  if (!soundEnabled()) return;
  if (typeof window === 'undefined') return;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new Ctor();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    /* audio unavailable — silently ignore */
  }
}
