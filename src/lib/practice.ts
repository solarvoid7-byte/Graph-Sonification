import type { Direction } from "./types";

export type PracticeEvent =
  | { type: "sound-enabled" }
  | { type: "mute-toggled" }
  | { type: "summary" }
  | { type: "travel"; fromId: string; toId: string; direction?: Direction }
  | { type: "playback-start" }
  | { type: "playback-stop" }
  | { type: "graph-changed"; graphId: string }
  | { type: "volume-changed" };

export interface PracticeMemory {
  playbackStarted: boolean;
}

export const emptyPracticeMemory = (): PracticeMemory => ({ playbackStarted: false });

export type PracticeKind =
  | "sound-enabled"
  | "mute-toggled"
  | "summary"
  | "travel-home-bus"
  | "direction-home-store"
  | "playback-cycle"
  | "graph-changed"
  | "volume-changed";

export function applyPractice(
  kind: PracticeKind,
  event: PracticeEvent,
  memory: PracticeMemory,
): { done: boolean; memory: PracticeMemory } {
  if (kind === "playback-cycle") {
    const playbackStarted = memory.playbackStarted || event.type === "playback-start";
    const done = playbackStarted && event.type === "playback-stop";
    return { done, memory: { playbackStarted } };
  }
  if (kind === "travel-home-bus") {
    const done = event.type === "travel" && event.fromId === "home" && event.toId === "bus-stop";
    return { done, memory };
  }
  if (kind === "direction-home-store") {
    const done =
      event.type === "travel" &&
      event.fromId === "home" &&
      event.toId === "store" &&
      event.direction === "right";
    return { done, memory };
  }
  if (kind === "graph-changed") {
    const done = event.type === "graph-changed" && event.graphId !== "neighborhood";
    return { done, memory };
  }
  if (event.type === kind) return { done: true, memory };
  return { done: false, memory };
}
