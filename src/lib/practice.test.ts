import { describe, expect, it } from "vitest";
import { applyPractice, emptyPracticeMemory } from "./practice";

describe("practice progress", () => {
  it("requires playback to start before a stop counts", () => {
    const first = applyPractice("playback-cycle", { type: "playback-stop" }, emptyPracticeMemory());
    expect(first.done).toBe(false);
    const started = applyPractice("playback-cycle", { type: "playback-start" }, first.memory);
    expect(started.done).toBe(false);
    const stopped = applyPractice("playback-cycle", { type: "playback-stop" }, started.memory);
    expect(stopped.done).toBe(true);
  });

  it("accepts only the asked-for trip", () => {
    expect(
      applyPractice("travel-home-bus", { type: "travel", fromId: "home", toId: "store" }, emptyPracticeMemory()).done,
    ).toBe(false);
    expect(
      applyPractice("direction-home-store", { type: "travel", fromId: "home", toId: "store" }, emptyPracticeMemory())
        .done,
    ).toBe(false);
    expect(
      applyPractice(
        "direction-home-store",
        { type: "travel", fromId: "home", toId: "store", direction: "right" },
        emptyPracticeMemory(),
      ).done,
    ).toBe(true);
    expect(applyPractice("graph-changed", { type: "graph-changed", graphId: "neighborhood" }, emptyPracticeMemory()).done).toBe(
      false,
    );
  });
});
