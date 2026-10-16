/**
 * Speech gate: decides from 10 readings a second whether somebody has been talking for a while.
 * Each reading is the energy of the voice band (300-3400 Hz) and of the whole spectrum. The noise floor follows the
 * quiet moments, so a noisy room does not raise the alarm and keyboard clicks (short, broadband) do not count.
 */
export interface SpeechReading {
  voice: number;
  total: number;
}

const TRIGGER_MS = 2500;
const FRAME_MS = 100;
const COOLDOWN_MS = 60_000;
const MIN_VOICE = 0.02;

export class SpeechGate {
  private floor = 0.005;
  private talking = 0;
  private mutedUntil = 0;

  /** true when speech lasted long enough (once per cooldown). `now` in ms. */
  update(r: SpeechReading, now: number): boolean {
    const ratio = r.total > 0 ? r.voice / r.total : 0;
    const voiced = r.voice > Math.max(MIN_VOICE, this.floor * 3) && ratio > 0.55;
    if (!voiced) this.floor = this.floor * 0.97 + r.voice * 0.03;
    this.talking = voiced ? this.talking + FRAME_MS : Math.max(0, this.talking - FRAME_MS / 2);
    if (this.talking >= TRIGGER_MS && now >= this.mutedUntil) {
      this.talking = 0;
      this.mutedUntil = now + COOLDOWN_MS;
      return true;
    }
    return false;
  }
}
