import { SpeechGate } from "./speech-core";

/** Listens to the microphone during the exam and reports sustained speech. The audio never leaves the machine: only the level is analysed. */
export class SpeechDetector {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private timer: number | undefined;

  async start(onSpeech: () => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.ctx = new AudioContext();
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024;
    this.ctx.createMediaStreamSource(this.stream).connect(analyser);
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const hz = this.ctx.sampleRate / analyser.fftSize;
    const lo = Math.floor(300 / hz);
    const hi = Math.ceil(3400 / hz);
    const gate = new SpeechGate();
    this.timer = window.setInterval(() => {
      analyser.getByteFrequencyData(bins);
      let voice = 0;
      let total = 0;
      bins.forEach((v, i) => {
        total += v;
        if (i >= lo && i <= hi) voice += v;
      });
      if (gate.update({ voice: voice / ((hi - lo + 1) * 255), total: total / (bins.length * 255) * ((hi - lo + 1) / bins.length) }, Date.now())) onSpeech();
    }, 100);
  }

  stop() {
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => undefined);
    this.stream = null;
    this.ctx = null;
  }
}
