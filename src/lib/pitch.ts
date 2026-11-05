const PENTATONIC = [0, 2, 4, 7, 9];

/** Map a value into a major pentatonic range so nearby numbers are easy to tell apart. */
export function valueToFrequency(value: number, min: number, max: number): number {
  const steps = 9;
  let t = 0.5;
  if (Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && max > min) {
    t = (value - min) / (max - min);
  }
  if (!Number.isFinite(t)) t = 0.5;
  t = Math.min(1, Math.max(0, t));
  const index = Math.round(t * (steps - 1));
  const degree = PENTATONIC[index % PENTATONIC.length] ?? 0;
  const octave = Math.floor(index / PENTATONIC.length);
  const semitone = degree + octave * 12;
  const frequency = 196 * 2 ** (semitone / 12);
  return Math.min(2000, Math.max(80, frequency));
}

/** Stereo position. Kept inside ±0.8 so a note is never silent in one ear. */
export function panForX(x: number): number {
  const safe = Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50;
  return Math.round((((safe / 100) * 2 - 1) * 0.8) * 100) / 100;
}

export function valueExtent(values: number[]): { min: number; max: number } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(volume * 20) / 20));
}

export function volumePercent(volume: number): number {
  return Math.round(clampVolume(volume) * 100);
}
