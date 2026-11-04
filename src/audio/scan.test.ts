import { describe, expect, it } from "vitest";
import {
  SAFE_MASTER_GAIN,
  crossedHorizontalAxis,
  describeEdit,
  frequencyForY,
  gridLinesCrossed,
  offGridSide,
  yValue,
} from "./scan";

describe("pitch safety", () => {
  it("keeps every height inside a comfortable band, including bad numbers", () => {
    const samples = [-10, -1, 0, 3, 10, 80, -80, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const y of samples) {
      const hz = frequencyForY(y);
      expect(Number.isFinite(hz)).toBe(true);
      expect(hz).toBeGreaterThanOrEqual(160);
      expect(hz).toBeLessThanOrEqual(880);
    }
    expect(frequencyForY(-10)).toBeLessThan(frequencyForY(0));
    expect(frequencyForY(0)).toBeLessThan(frequencyForY(10));
    expect(frequencyForY(80)).toBe(frequencyForY(10));
    expect(SAFE_MASTER_GAIN).toBeLessThanOrEqual(0.08);
  });

  it("maps a straight line and a sine wave without NaN", () => {
    expect(yValue("linear", 2, 3, -1.5)).toBe(0);
    expect(yValue("sine", 1, 0, 0)).toBe(0);
    expect(yValue("sine", 2, 3, Math.PI / 2)).toBeCloseTo(5);
    expect(Number.isFinite(yValue("sine", Number.NaN, Number.NaN, Number.NaN))).toBe(true);
    expect(yValue("horizontal", 9, 4, -6)).toBe(4);
  });
});

describe("grid ticks", () => {
  it("fires on the vertical axis and does not repeat the line it already left", () => {
    expect(gridLinesCrossed(null, -10)).toEqual([-10]);
    expect(gridLinesCrossed(-10, -9.4)).toEqual([]);
    expect(gridLinesCrossed(-0.4, 0.2)).toEqual([0]);
    expect(gridLinesCrossed(-9, -7)).toEqual([-8]);
    expect(gridLinesCrossed(Number.NaN, 0)).toEqual([0]);
  });

  it("notices the x-intercept once, when height changes sign", () => {
    expect(crossedHorizontalAxis(2, -1)).toBe(true);
    expect(crossedHorizontalAxis(-0.2, 0)).toBe(true);
    expect(crossedHorizontalAxis(0, 1)).toBe(false);
    expect(crossedHorizontalAxis(null, -3)).toBe(false);
    expect(offGridSide(-17)).toBe("below");
    expect(offGridSide(3)).toBeNull();
  });
});

describe("student number messages", () => {
  it("explains a number that is too big or not a number", () => {
    expect(describeEdit("Slope", "25", 10)).toMatch(/higher than 10/);
    expect(describeEdit("Slope", "abc", 0)).toMatch(/ordinary number/);
    expect(describeEdit("Constant", "-4", -4)).toMatch(/minus 4/);
  });
});
