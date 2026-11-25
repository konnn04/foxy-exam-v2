import { diag } from "./diag";
import { SpeechGate, SpeechVoteGate, speechScore } from "./speech-core";

const AUDIO_WASM = "/mediapipe/audio-wasm";
const AUDIO_MODEL = "/mediapipe/yamnet.tflite";

interface Classifier {
  classify(data: Float32Array, sampleRate?: number): { classifications: { categories: { categoryName: string; score: number }[] }[] }[];
  close(): void;
}

async function createClassifier(): Promise<Classifier> {
  const { AudioClassifier, FilesetResolver } = await import("@mediapipe/tasks-audio");
  const fileset = await FilesetResolver.forAudioTasks(AUDIO_WASM);
  return (await AudioClassifier.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: AUDIO_MODEL },
    maxResults: 5,
    scoreThreshold: 0.1,
  })) as unknown as Classifier;
}

/**
 * Listens to the microphone during the exam and reports sustained speech. The audio never leaves the machine.
 * First choice: MediaPipe Audio Classifier (YAMNet) tells speech from coughs, music, typing… on ~1 s windows.
 * If it cannot load, the old voice-band energy heuristic takes over.
 */
export class SpeechDetector {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private timer: number | undefined;

  private classifier: Classifier | null = null;
  private node: ScriptProcessorNode | null = null;

  async start(onSpeech: () => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.ctx = new AudioContext();
    try {
      this.classifier = await createClassifier();
      this.listenWithClassifier(onSpeech);
      diag("audio: YAMNet speech detection running");
      return;
    } catch (e) {
      diag(`audio: YAMNet unavailable, using the energy heuristic (${e instanceof Error ? e.message : String(e)})`);
      this.classifier = null;
    }
    this.listenWithEnergy(onSpeech);
  }

  /** ~1 s of samples per classification; the processor node is the one capture API every webview still has. */
  private listenWithClassifier(onSpeech: () => void) {
    const ctx = this.ctx!;
    const src = ctx.createMediaStreamSource(this.stream!);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0; // the node only runs while connected to the output; keep it silent
    const need = Math.round(ctx.sampleRate * 0.975);
    let buf = new Float32Array(need);
    let filled = 0;
    const gate = new SpeechVoteGate();
    node.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0);
      let i = 0;
      while (i < input.length) {
        const n = Math.min(input.length - i, need - filled);
        buf.set(input.subarray(i, i + n), filled);
        filled += n;
        i += n;
        if (filled < need) continue;
        const window = buf;
        buf = new Float32Array(need);
        filled = 0;
        try {
          const results = this.classifier?.classify(window, ctx.sampleRate) ?? [];
          let score = 0;
          for (const r of results) score = Math.max(score, speechScore(r.classifications[0]?.categories ?? []));
          if (gate.update(score, Date.now())) onSpeech();
        } catch {
          /* one bad window is skipped */
        }
      }
    };
    src.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    this.node = node;
  }

  private listenWithEnergy(onSpeech: () => void) {
    if (!this.ctx || !this.stream) return;
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
    if (this.node) this.node.onaudioprocess = null;
    this.node?.disconnect();
    this.node = null;
    this.classifier?.close();
    this.classifier = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => undefined);
    this.stream = null;
    this.ctx = null;
  }
}
