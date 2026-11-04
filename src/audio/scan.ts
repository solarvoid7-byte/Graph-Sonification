export type EquationKind = "linear" | "horizontal" | "slope" | "sine";

/**
 * Digital ceiling for every tone.
 * A browser cannot measure dBA, so the cap is a fixed peak of 0.08
 * (about -22 dBFS). At a normal computer volume that keeps a sustained
 * sine near conversation level, about 75 dBA, instead of a full-scale beep.
 * A limiter sits after this gain so a tick cannot jump louder than the tone.
 */
export const SAFE_MASTER_GAIN = 0.08;

export const GRID_LINES = [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10] as const;

export function clampParam(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(-10, value));
}

export function parseParam(raw: string): number {
  const value = Number(raw);
  return clampParam(value);
}

export function describeEdit(name: string, raw: string, applied: number): string {
  const trimmed = raw.trim();
  const typed = Number(trimmed);
  const shown = applied < 0 ? `minus ${Math.abs(applied)}` : String(applied);
  if (trimmed === "" || !Number.isFinite(typed)) {
    return `${name} has to be an ordinary number, like 2 or minus 3. I set it to ${shown}.`;
  }
  if (typed > 10) {
    return `${typed} is higher than 10. I set ${name} to 10 so the sound stays at a safe volume.`;
  }
  if (typed < -10) {
    return `${typed} is lower than minus 10. I set ${name} to minus 10 so the sound stays at a safe volume.`;
  }
  return `${name} is ${shown}.`;
}

export function yValue(kind: EquationKind, slope: number, constant: number, x: number): number {
  const safeSlope = Number.isFinite(slope) ? slope : 0;
  const safeConstant = Number.isFinite(constant) ? constant : 0;
  const safeX = Number.isFinite(x) ? x : 0;
  if (kind === "horizontal") return safeConstant;
  if (kind === "slope") return safeSlope * safeX;
  if (kind === "sine") return safeSlope * Math.sin(safeX) + safeConstant;
  return safeSlope * safeX + safeConstant;
}

export function frequencyForY(y: number): number {
  if (!Number.isFinite(y)) return 392;
  const clamped = Math.min(10, Math.max(-10, y));
  const hz = 196 * 2 ** ((clamped + 10) / 10);
  if (!Number.isFinite(hz)) return 392;
  return Math.min(880, Math.max(160, hz));
}

export function offGridSide(y: number): "above" | "below" | null {
  if (!Number.isFinite(y)) return null;
  if (y > 10) return "above";
  if (y < -10) return "below";
  return null;
}

export function gridLinesCrossed(previous: number | null, x: number): number[] {
  if (!Number.isFinite(x)) return [];
  const hit: number[] = [];
  for (const line of GRID_LINES) {
    if (previous === null || !Number.isFinite(previous)) {
      if (Math.abs(x - line) < 1e-6) hit.push(line);
      continue;
    }
    if (Math.abs(previous - line) < 1e-6) continue;
    const crossed = (previous - line) * (x - line) < 0 || Math.abs(x - line) < 1e-6;
    if (crossed) hit.push(line);
  }
  return hit;
}

export function crossedHorizontalAxis(previousY: number | null, y: number): boolean {
  if (previousY === null || !Number.isFinite(previousY) || !Number.isFinite(y)) return false;
  if (Math.abs(previousY) < 1e-9) return false;
  if (Math.abs(y) < 1e-9) return true;
  return previousY * y < 0;
}

interface ScanHandlers {
  yAt: (x: number) => number;
  onPosition: (x: number) => void;
  onEnd: () => void;
  onVerticalAxis?: () => void;
  onHorizontalAxis?: () => void;
  onOffGrid?: (side: "above" | "below") => void;
}

export class LineScanner {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private osc: OscillatorNode | null = null;
  private voice: GainNode | null = null;
  private master: GainNode | null = null;
  private running = false;

  get playing(): boolean {
    return this.running;
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const osc = this.osc;
    const voice = this.voice;
    const ctx = this.ctx;
    this.osc = null;
    this.voice = null;
    if (voice && ctx) {
      const now = ctx.currentTime;
      try {
        voice.gain.cancelScheduledValues(now);
        const current = Number.isFinite(voice.gain.value) ? Math.max(0.0001, voice.gain.value) : 0.0001;
        voice.gain.setValueAtTime(current, now);
        voice.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      } catch {
        // Mocks and old engines can reject a ramp. The oscillator still stops.
      }
    }
    window.setTimeout(() => {
      try {
        osc?.stop();
      } catch {
        // Already stopped.
      }
    }, 50);
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
    const master = this.output(ctx);
    const voice = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const y0 = handlers.yAt(-10);
    osc.frequency.value = frequencyForY(y0);
    let panner: StereoPannerNode | null = null;
    try {
      panner = ctx.createStereoPanner();
    } catch {
      panner = null;
    }
    if (panner) {
      osc.connect(panner);
      panner.connect(voice);
    } else {
      osc.connect(voice);
    }
    voice.connect(master);
    const now = ctx.currentTime;
    voice.gain.setValueAtTime(0.0001, now);
    voice.gain.exponentialRampToValueAtTime(0.7, now + 0.06);
    osc.start();
    this.osc = osc;
    this.voice = voice;

    const steps = 80;
    let index = 0;
    let previousX: number | null = null;
    let previousY: number | null = null;
    const announced = new Set<string>();
    this.timer = window.setInterval(() => {
      if (!this.running || !this.ctx) return;
      const x = -10 + (20 * index) / (steps - 1);
      const y = handlers.yAt(x);
      const hz = frequencyForY(y);
      const at = this.ctx.currentTime;
      if (typeof osc.frequency.setTargetAtTime === "function") osc.frequency.setTargetAtTime(hz, at, 0.02);
      else osc.frequency.value = hz;
      if (panner) panner.pan.value = Math.min(0.8, Math.max(-0.8, x / 12.5));
      for (const line of gridLinesCrossed(previousX, x)) {
        this.blip(line === 0 ? 1480 : 880, line === 0 ? 0.045 : 0.03);
        if (line === 0 && !announced.has("vertical")) {
          announced.add("vertical");
          handlers.onVerticalAxis?.();
        }
      }
      if (crossedHorizontalAxis(previousY, y) && !announced.has("horizontal")) {
        announced.add("horizontal");
        this.blip(240, 0.05);
        handlers.onHorizontalAxis?.();
      } else if (crossedHorizontalAxis(previousY, y)) {
        this.blip(240, 0.04);
      }
      const side = offGridSide(y);
      if (side && !announced.has(side)) {
        announced.add(side);
        handlers.onOffGrid?.(side);
      }
      handlers.onPosition(x);
      previousX = x;
      previousY = Number.isFinite(y) ? y : previousY;
      index += 1;
      if (index >= steps) {
        this.stop();
        handlers.onEnd();
      }
    }, 55);
    return true;
  }

  private output(ctx: AudioContext): GainNode {
    if (this.master) return this.master;
    const master = ctx.createGain();
    master.gain.value = SAFE_MASTER_GAIN;
    let destination: AudioNode = ctx.destination;
    try {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -24;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      limiter.connect(ctx.destination);
      destination = limiter;
    } catch {
      destination = ctx.destination;
    }
    master.connect(destination);
    this.master = master;
    return master;
  }

  private blip(frequency: number, peak: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.running) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = Math.min(1600, Math.max(160, Number.isFinite(frequency) ? frequency : 440));
    const now = ctx.currentTime;
    const level = Math.min(0.5, Math.max(0.0001, peak));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}
