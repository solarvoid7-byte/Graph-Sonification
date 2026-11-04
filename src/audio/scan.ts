export type EquationKind = "linear" | "horizontal" | "slope";

export function clampParam(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(-10, value));
}

export function parseParam(raw: string): number {
  const value = Number(raw);
  return clampParam(value);
}

export function yValue(kind: EquationKind, slope: number, constant: number, x: number): number {
  if (kind === "horizontal") return constant;
  if (kind === "slope") return slope * x;
  return slope * x + constant;
}

export function frequencyForY(y: number): number {
  const clamped = Math.min(10, Math.max(-10, y));
  return 196 * 2 ** ((clamped + 10) / 10);
}

interface ScanHandlers {
  yAt: (x: number) => number;
  onPosition: (x: number) => void;
  onEnd: () => void;
}

export class LineScanner {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private osc: OscillatorNode | null = null;
  private running = false;

  get playing(): boolean {
    return this.running;
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.osc) {
      try {
        this.osc.stop();
      } catch {
        // Already stopped.
      }
    }
    this.osc = null;
  }

  async start(handlers: ScanHandlers): Promise<boolean> {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      if (!this.ctx) this.ctx = new Ctx();
      if (this.ctx.state !== "running") await this.ctx.resume();
      if (this.ctx.state !== "running") return false;
    } catch {
      return false;
    }

    this.stop();
    this.running = true;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.22;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 440;
    let panner: StereoPannerNode | null = null;
    try {
      panner = ctx.createStereoPanner();
    } catch {
      panner = null;
    }
    if (panner) {
      osc.connect(panner);
      panner.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(ctx.destination);
    osc.start();
    this.osc = osc;

    const steps = 80;
    let index = 0;
    this.timer = window.setInterval(() => {
      if (!this.running) return;
      const x = -10 + (20 * index) / (steps - 1);
      const y = handlers.yAt(x);
      osc.frequency.value = frequencyForY(y);
      if (panner) panner.pan.value = Math.min(0.8, Math.max(-0.8, x / 10));
      handlers.onPosition(x);
      index += 1;
      if (index >= steps) {
        this.stop();
        handlers.onEnd();
      }
    }, 55);
    return true;
  }
}
