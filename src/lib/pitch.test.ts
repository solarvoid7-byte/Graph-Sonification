import { describe, expect, it } from "vitest";
import { clampVolume, panForX, valueToFrequency } from "./pitch";

describe("pitch", () => {
  it("maps larger values to higher or equal notes", () => {
    const low = valueToFrequency(12, 12, 21);
    const mid = valueToFrequency(16, 12, 21);
    const high = valueToFrequency(21, 12, 21);
    expect(high).toBeGreaterThan(low);
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(mid).toBeLessThanOrEqual(high);
  });

  it("uses one pitch when every value is the same", () => {
    expect(valueToFrequency(4, 4, 4)).toBe(valueToFrequency(4, 4, 4));
  });

  it("keeps pan inside both ears and clamps bad volume", () => {
    expect(panForX(0)).toBeGreaterThan(-1);
    expect(panForX(100)).toBeLessThan(1);
    expect(panForX(0)).toBeLessThan(0);
    expect(panForX(100)).toBeGreaterThan(0);
    expect(panForX(Number.NaN)).toBe(0);
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(0.5);
    expect(clampVolume(-1)).toBe(0);
  });
});
