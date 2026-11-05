import { beforeEach, describe, expect, it } from "vitest";
import { loadSession, reduce } from "./reduce";

describe("session", () => {
  beforeEach(() => localStorage.clear());

  it("ignores a broken saved session", () => {
    localStorage.setItem("graph-sonification-settings", "{");
    const session = loadSession();
    expect(session.graphId).toBe("neighborhood");
    expect(session.currentNodeId).toBe("home");
    expect(session.tutorialOpen).toBe(true);
  });

  it("refuses a trip that is not a connection and clamps volume", () => {
    const start = loadSession();
    const blocked = reduce(start, { type: "travel", toId: "notice" });
    expect(blocked.state.currentNodeId).toBe("home");
    expect(blocked.effects.some((effect) => effect.type === "boundary")).toBe(true);

    const loud = reduce(start, { type: "set-volume", volume: 9, announce: true });
    expect(loud.state.volume).toBe(1);
    const quiet = reduce(loud.state, { type: "set-volume", volume: 9, announce: false });
    expect(quiet.effects.some((effect) => effect.type === "practice")).toBe(false);
  });

  it("steps back along a jump without pretending it was a connection", () => {
    const start = loadSession();
    const jumped = reduce(start, { type: "jump", nodeId: "library" });
    const back = reduce(jumped.state, { type: "step-back" });
    expect(back.state.currentNodeId).toBe("home");
    expect(back.state.arrivedFromId).toBe("library");
    expect(back.effects.some((effect) => effect.type === "glide")).toBe(false);
    expect(back.effects.find((effect) => effect.type === "announce")).toMatchObject({
      message: expect.stringMatching(/jump/i),
    });
    const stuck = reduce(back.state, { type: "step-back" });
    expect(stuck.state.walk).toHaveLength(1);
  });


  it("does not send the next connection straight back after a real step back", () => {
    const start = loadSession();
    const gone = reduce(start, { type: "travel", toId: "bus-stop" });
    const back = reduce(gone.state, { type: "step-back" });
    expect(back.state.currentNodeId).toBe("home");
    expect(back.state.arrivedFromId).toBe("bus-stop");
    expect(back.effects.find((effect) => effect.type === "announce")).toMatchObject({
      message: expect.stringMatching(/connection/i),
    });
  });

  it("says a muted test note was silent", () => {
    const start = loadSession();
    const muted = reduce(start, { type: "set-muted", muted: true });
    const enabled = reduce(muted.state, { type: "enable-sound", ok: true });
    const message = enabled.effects.find((effect) => effect.type === "announce");
    expect(message && message.type === "announce" ? message.message : "").toMatch(/muted/i);
  });

  it("does not count a tutorial placement as the graph-change practice", () => {
    const start = loadSession();
    const placed = reduce(start, { type: "place", graphId: "temperatures", nodeId: "mon", announcement: "Ready." });
    expect(placed.state.currentNodeId).toBe("mon");
    expect(placed.effects.some((effect) => effect.type === "practice")).toBe(false);
    const changed = reduce(placed.state, { type: "set-graph", graphId: "team" });
    expect(changed.effects.some((effect) => effect.type === "practice")).toBe(true);
  });
});
