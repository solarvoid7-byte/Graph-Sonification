import { linksFrom, nodeById } from "../lib/graph";
import { panForX, valueExtent, valueToFrequency } from "../lib/pitch";
import type { GraphData } from "../lib/types";

interface Voice {
  stop: () => void;
}

/**
 * Musical tones for nodes and connections.
 * Screen-reader speech is intentionally not produced here.
 */

const SAFE_MASTER_GAIN = 0.08;

function safeMasterGain(volume: number): number {
  if (!Number.isFinite(volume)) return 0.05;
  return Math.min(SAFE_MASTER_GAIN, Math.max(0, volume));
}

function safeFrequency(frequency: number): number {
  if (!Number.isFinite(frequency)) return 392;
  return Math.min(2000, Math.max(80, frequency));
}

export class Sonifier {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: Voice[] = [];
  private volume = 0.6;
  private muted = false;
  private failed = false;
  private settle: (() => void) | null = null;
  private finishToken = 0;
  private epoch = 0;
  private active = 0;

  get isReady(): boolean {
    return Boolean(this.ctx && this.ctx.state === "running");
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master && !this.muted) this.master.gain.value = safeMasterGain(volume);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : safeMasterGain(this.volume);
  }

  async ensureStarted(): Promise<boolean> {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) {
      this.failed = true;
      return false;
    }
    try {
      if (!this.ctx) {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : safeMasterGain(this.volume);
        const destination = this.output(this.ctx);
        this.master.connect(destination);
      }
      const pending = this.ctx.state === "suspended" ? this.ctx.resume() : Promise.resolve();
      await pending;
      return this.ctx.state === "running";
    } catch {
      this.failed = true;
      return false;
    }
  }

  private output(ctx: AudioContext): AudioNode {
    try {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      compressor.connect(ctx.destination);
      return compressor;
    } catch {
      return ctx.destination;
    }
  }

  stopAll(): boolean {
    this.epoch += 1;
    return this.silenceVoices();
  }

  private silenceVoices(): boolean {
    const had = this.active > 0;
    this.active = 0;
    const voices = this.voices.splice(0);
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {
        // Oscillators throw if they were already stopped.
      }
    }
    const settle = this.settle;
    this.settle = null;
    this.finishToken += 1;
    settle?.();
    return had;
  }

  private finishSoon(ms: number): Promise<void> {
    const token = ++this.finishToken;
    let settled = false;
    return new Promise((resolve) => {
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      this.settle = done;
      window.setTimeout(() => {
        if (token !== this.finishToken) return;
        this.settle = null;
        done();
      }, ms);
    });
  }

  async playTestTone(): Promise<void> {
    await this.tone({ frequency: 523.25, pan: 0, duration: 0.28, type: "sine", gain: 0.35 });
  }

  async playCue(frequency: number, pan: number): Promise<void> {
    await this.tone({ frequency, pan, duration: 0.34, type: "sine", gain: 0.34 });
  }

  async playPair(firstHz: number, secondHz: number): Promise<void> {
    const epoch = this.epoch;
    await this.tone({ frequency: firstHz, pan: 0, duration: 0.28, type: "sine", gain: 0.34 });
    if (this.epoch !== epoch) return;
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 160);
    });
    if (this.epoch !== epoch) return;
    await this.tone({ frequency: secondHz, pan: 0, duration: 0.28, type: "sine", gain: 0.34 });
  }

  async playBoundary(): Promise<void> {
    await this.tone({ frequency: 110, pan: 0, duration: 0.07, type: "sine", gain: 0.28 });
    await this.wait(50);
    await this.tone({ frequency: 98, pan: 0, duration: 0.09, type: "sine", gain: 0.28 });
  }

  async playNode(graph: GraphData, nodeId: string, preview = false): Promise<void> {
    const node = nodeById(graph, nodeId);
    if (!node) return;
    const { min, max } = valueExtent(graph.nodes.map((item) => item.value));
    const degree = linksFrom(graph, node.id).length;
    const duration = (preview ? 0.12 : 0.2) + Math.min(degree, 4) * 0.045;
    const frequency = valueToFrequency(node.value, min, max);
    const chime = node.id === graph.startNodeId && !preview;
    await this.tone({
      frequency,
      pan: panForX(node.x),
      duration,
      type: "sine",
      gain: preview ? 0.22 : 0.34,
      harmonic: chime,
    });
  }

  async playGlide(graph: GraphData, fromId: string, toId: string): Promise<void> {
    const from = nodeById(graph, fromId);
    const to = nodeById(graph, toId);
    if (!from || !to) return;
    const { min, max } = valueExtent(graph.nodes.map((item) => item.value));
    const fromHz = valueToFrequency(from.value, min, max);
    const toHz = valueToFrequency(to.value, min, max);
    if (Math.abs(fromHz - toHz) < 1) {
      await this.tone({ frequency: toHz, pan: panForX(to.x), duration: 0.12, type: "sine", gain: 0.3 });
      await this.wait(40);
      await this.tone({ frequency: toHz, pan: panForX(to.x), duration: 0.14, type: "sine", gain: 0.3 });
      return;
    }
    await this.glide({
      fromHz,
      toHz,
      fromPan: panForX(from.x),
      toPan: panForX(to.x),
    });
  }

  private async wait(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  private async tone(options: {
    frequency: number;
    pan: number;
    duration: number;
    type: OscillatorType;
    gain: number;
    harmonic?: boolean;
  }): Promise<void> {
    this.silenceVoices();
    if (this.muted || this.failed || !this.ctx || !this.master || this.ctx.state !== "running") {
      await this.finishSoon(options.duration * 1000);
      return;
    }
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type;
    osc.frequency.value = safeFrequency(options.frequency);
    const panner = this.panner(ctx, options.pan);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.2, Math.max(0.001, options.gain)), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    const extras: OscillatorNode[] = [];
    if (options.harmonic) {
      const overtone = ctx.createOscillator();
      const overGain = ctx.createGain();
      overtone.type = "sine";
      overtone.frequency.value = safeFrequency(options.frequency * 2);
      overGain.gain.setValueAtTime(0.0001, now);
      overGain.gain.exponentialRampToValueAtTime(options.gain * 0.18, now + 0.02);
      overGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.18, options.duration));
      overtone.connect(overGain);
      overGain.connect(panner);
      extras.push(overtone);
    }
    const voice: Voice = {
      stop: () => {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
        for (const extra of extras) {
          try {
            extra.stop();
          } catch {
            // already stopped
          }
        }
        osc.disconnect();
        gain.disconnect();
      },
    };
    this.voices.push(voice);
    this.active += 1;
    osc.onended = () => {
      this.active = Math.max(0, this.active - 1);
    };
    osc.start(now);
    for (const extra of extras) extra.start(now);
    osc.stop(now + options.duration + 0.02);
    for (const extra of extras) extra.stop(now + options.duration + 0.02);
    await this.finishSoon(options.duration * 1000 + 30);
  }

  private async glide(options: { fromHz: number; toHz: number; fromPan: number; toPan: number }): Promise<void> {
    this.silenceVoices();
    const duration = 0.42;
    if (this.muted || this.failed || !this.ctx || !this.master || this.ctx.state !== "running") {
      await this.finishSoon(duration * 1000);
      return;
    }
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(safeFrequency(options.fromHz), now);
    osc.frequency.linearRampToValueAtTime(safeFrequency(options.toHz), now + 0.28);
    const panner = this.automatedPanner(ctx, options.fromPan, options.toPan, 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
    gain.gain.setValueAtTime(0.2, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    const voice: Voice = {
      stop: () => {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
        osc.disconnect();
        gain.disconnect();
      },
    };
    this.voices.push(voice);
    this.active += 1;
    osc.onended = () => {
      this.active = Math.max(0, this.active - 1);
    };
    osc.start(now);
    osc.stop(now + duration + 0.02);
    await this.finishSoon(duration * 1000);
  }

  private panner(ctx: AudioContext, pan: number): AudioNode {
    try {
      if (typeof ctx.createStereoPanner === "function") {
        const node = ctx.createStereoPanner();
        node.pan.value = pan;
        return node;
      }
    } catch {
      // Older engines without a stereo panner still play the note in the center.
    }
    const gain = ctx.createGain();
    return gain;
  }

  private automatedPanner(ctx: AudioContext, from: number, to: number, seconds: number): AudioNode {
    try {
      if (typeof ctx.createStereoPanner === "function") {
        const node = ctx.createStereoPanner();
        const now = ctx.currentTime;
        node.pan.setValueAtTime(from, now);
        node.pan.linearRampToValueAtTime(to, now + seconds);
        return node;
      }
    } catch {
      // Fall through to an unpanned gain node.
    }
    return ctx.createGain();
  }
}
