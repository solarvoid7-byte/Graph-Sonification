import { graphById, graphs } from "../lib/samples";
import { graphChangeMessage, jumpMessage, travelMessage, whereYouAre } from "../lib/labels";
import { connectionCountPhrase, isNeighbor, linkBetween, nodeById } from "../lib/graph";
import type { PracticeEvent } from "../lib/practice";
import { clampVolume } from "../lib/pitch";
import { clampStep } from "../lib/tutorial";
import type { Direction, GraphData, Verbosity } from "../lib/types";

export interface WalkEntry {
  nodeId: string;
  via: "start" | "travel" | "jump";
  fromId: string | null;
}

export type PracticeStatus = "idle" | "done" | "skipped";
export type QuizStatus = "idle" | "passed";

export interface SessionState {
  graphId: string;
  currentNodeId: string;
  arrivedFromId: string | null;
  walk: WalkEntry[];
  muted: boolean;
  volume: number;
  verbosity: Verbosity;
  previewTones: boolean;
  announceDuringPlayback: boolean;
  browserVoice: boolean;
  soundEnabled: boolean;
  tutorialOpen: boolean;
  tutorialStep: number;
  practice: Record<string, PracticeStatus>;
  quiz: Record<string, QuizStatus>;
  helpOpen: boolean;
  search: string;
}

export type Effect =
  | { type: "announce"; channel: "polite" | "assertive"; message: string }
  | { type: "tone"; graphId: string; nodeId: string }
  | { type: "glide"; graphId: string; fromId: string; toId: string }
  | { type: "boundary" }
  | { type: "test-tone" }
  | { type: "stop-audio" }
  | { type: "practice"; event: PracticeEvent };

export type Action =
  | { type: "enable-sound"; ok: boolean; quiet?: boolean }
  | { type: "replay-test" }
  | { type: "set-muted"; muted: boolean }
  | { type: "set-volume"; volume: number; announce: boolean }
  | { type: "set-verbosity"; verbosity: Verbosity }
  | { type: "set-preview"; value: boolean }
  | { type: "set-announce-playback"; value: boolean }
  | { type: "set-browser-voice"; value: boolean }
  | { type: "set-search"; search: string }
  | { type: "jump"; nodeId: string }
  | {
      type: "travel";
      toId: string;
      wrapped?: boolean;
      onlyOne?: boolean;
      direction?: Direction;
      ambiguousLabel?: string;
    }
  | { type: "step-back" }
  | { type: "set-graph"; graphId: string }
  | { type: "place"; graphId: string; nodeId: string; announcement?: string }
  | { type: "summary" }
  | { type: "set-tutorial-open"; open: boolean; quiet?: boolean }
  | { type: "set-tutorial-step"; step: number }
  | { type: "mark-practice"; id: string; status: PracticeStatus }
  | { type: "mark-quiz"; id: string; status: QuizStatus }
  | { type: "set-help"; open: boolean }
  | { type: "boundary"; message: string };

const STORAGE_KEY = "graph-sonification-settings";

interface StoredSettings {
  graphId?: string;
  currentNodeId?: string;
  muted?: boolean;
  volume?: number;
  verbosity?: Verbosity;
  previewTones?: boolean;
  announceDuringPlayback?: boolean;
  browserVoice?: boolean;
  tutorialOpen?: boolean;
  tutorialStep?: number;
  practice?: Record<string, PracticeStatus>;
  quiz?: Record<string, QuizStatus>;
}

function defaultState(): SessionState {
  const graph = graphs[0]!;
  return {
    graphId: graph.id,
    currentNodeId: graph.startNodeId,
    arrivedFromId: null,
    walk: [{ nodeId: graph.startNodeId, via: "start", fromId: null }],
    muted: false,
    volume: 0.6,
    verbosity: "standard",
    previewTones: true,
    announceDuringPlayback: false,
    browserVoice: false,
    soundEnabled: false,
    tutorialOpen: true,
    tutorialStep: 0,
    practice: {},
    quiz: {},
    helpOpen: false,
    search: "",
  };
}

function freshWalk(nodeId: string): WalkEntry[] {
  return [{ nodeId, via: "start", fromId: null }];
}

export function loadSession(): SessionState {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const stored = JSON.parse(raw) as StoredSettings;
    const graph = graphById(typeof stored.graphId === "string" ? stored.graphId : base.graphId);
    const node = nodeById(graph, stored.currentNodeId) ?? nodeById(graph, graph.startNodeId);
    const nodeId = node?.id ?? graph.startNodeId;
    const verbosity: Verbosity =
      stored.verbosity === "terse" || stored.verbosity === "detailed" || stored.verbosity === "standard"
        ? stored.verbosity
        : "standard";
    return {
      ...base,
      graphId: graph.id,
      currentNodeId: nodeId,
      walk: freshWalk(nodeId),
      muted: Boolean(stored.muted),
      volume: clampVolume(typeof stored.volume === "number" ? stored.volume : base.volume),
      verbosity,
      previewTones: stored.previewTones !== false,
      announceDuringPlayback: Boolean(stored.announceDuringPlayback),
      browserVoice: Boolean(stored.browserVoice),
      tutorialOpen: stored.tutorialOpen !== false,
      tutorialStep: clampStep(typeof stored.tutorialStep === "number" ? stored.tutorialStep : 0),
      practice: sanitizeStatus(stored.practice),
      quiz: sanitizeQuiz(stored.quiz),
    };
  } catch {
    return base;
  }
}

function sanitizeStatus(value: unknown): Record<string, PracticeStatus> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, PracticeStatus> = {};
  for (const [key, status] of Object.entries(value)) {
    if (status === "done" || status === "skipped" || status === "idle") result[key] = status;
  }
  return result;
}

function sanitizeQuiz(value: unknown): Record<string, QuizStatus> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, QuizStatus> = {};
  for (const [key, status] of Object.entries(value)) {
    if (status === "passed" || status === "idle") result[key] = status;
  }
  return result;
}

export function saveSession(state: SessionState): void {
  const payload: StoredSettings = {
    graphId: state.graphId,
    currentNodeId: state.currentNodeId,
    muted: state.muted,
    volume: state.volume,
    verbosity: state.verbosity,
    previewTones: state.previewTones,
    announceDuringPlayback: state.announceDuringPlayback,
    browserVoice: state.browserVoice,
    tutorialOpen: state.tutorialOpen,
    tutorialStep: state.tutorialStep,
    practice: state.practice,
    quiz: state.quiz,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode and blocked storage still leave the session usable.
  }
}

export function currentGraph(state: SessionState): GraphData {
  return graphById(state.graphId);
}


function hearingCaveat(state: SessionState): string | null {
  if (state.muted) return "Tones are muted, so that note was silent. Activate Unmute tones, then try the test note again.";
  if (state.volume <= 0.001) return "Tone volume is 0 percent, so that note was silent. Raise Tone volume, then try the test note again.";
  return null;
}

function withNode(state: SessionState): { state: SessionState; graph: GraphData } {
  const graph = currentGraph(state);
  if (nodeById(graph, state.currentNodeId)) return { state, graph };
  const nodeId = graph.startNodeId;
  return {
    graph,
    state: { ...state, currentNodeId: nodeId, arrivedFromId: null, walk: freshWalk(nodeId) },
  };
}

export function reduce(state: SessionState, action: Action): { state: SessionState; effects: Effect[] } {
  const checked = withNode(state);
  state = checked.state;
  const graph = checked.graph;
  const current = nodeById(graph, state.currentNodeId)!;

  switch (action.type) {
    case "enable-sound": {
      if (!action.ok) {
        return {
          state: { ...state, soundEnabled: false },
          effects: [
            {
              type: "announce",
              channel: "assertive",
              message:
                "This browser could not start audio. You can still use every list, button, and announcement. Tones will be silent.",
            },
          ],
        };
      }
      const note = hearingCaveat(state);
      return {
        state: { ...state, soundEnabled: true },
        effects: action.quiet
          ? [{ type: "practice", event: { type: "sound-enabled" } }]
          : [
              { type: "test-tone" },
              {
                type: "announce",
                channel: "polite",
                message: note
                  ? `Sound is on. ${note}`
                  : "Sound is on. You should have heard a short note.",
              },
              { type: "practice", event: { type: "sound-enabled" } },
            ],
      };
    }
    case "replay-test": {
      if (!state.soundEnabled) {
        return reduce(state, { type: "enable-sound", ok: true });
      }
      const note = hearingCaveat(state);
      return {
        state,
        effects: [
          { type: "test-tone" },
          { type: "announce", channel: "polite", message: note ? `Test note. ${note}` : "Test note." },
          { type: "practice", event: { type: "sound-enabled" } },
        ],
      };
    }
    case "set-muted": {
      return {
        state: { ...state, muted: action.muted },
        effects: [
          {
            type: "announce",
            channel: "polite",
            message: action.muted
              ? "Tones muted. Screen reader announcements stay on."
              : "Tones on.",
          },
          { type: "practice", event: { type: "mute-toggled" } },
        ],
      };
    }
    case "set-volume": {
      const volume = clampVolume(action.volume);
      const effects: Effect[] = [];
      if (action.announce) {
        effects.push({
          type: "announce",
          channel: "polite",
          message: `Tone volume ${Math.round(volume * 100)} percent.`,
        });
      }
      if (volume !== state.volume) {
        effects.push({ type: "practice", event: { type: "volume-changed" } });
      }
      return { state: { ...state, volume }, effects };
    }
    case "set-verbosity":
      return {
        state: { ...state, verbosity: action.verbosity },
        effects: [
          {
            type: "announce",
            channel: "polite",
            message: `Verbosity ${action.verbosity === "terse" ? "short" : action.verbosity}.`,
          },
        ],
      };
    case "set-preview":
      return {
        state: { ...state, previewTones: action.value },
        effects: [
          {
            type: "announce",
            channel: "polite",
            message: action.value
              ? "Preview tones in lists are on."
              : "Preview tones in lists are off. Travel still plays a glide.",
          },
        ],
      };
    case "set-announce-playback":
      return {
        state: { ...state, announceDuringPlayback: action.value },
        effects: [
          {
            type: "announce",
            channel: "polite",
            message: action.value
              ? "Playback will announce each node."
              : "Playback will announce the order, then only tones, then the finish.",
          },
        ],
      };
    case "set-browser-voice": {
      const effects: Effect[] = [];
      if (action.value) effects.push({ type: "stop-audio" });
      effects.push({
        type: "announce",
        channel: "polite",
        message: action.value
          ? "Browser voice is on. Turn this off if you already use a screen reader, or the page will talk over it."
          : "Browser voice is off. Your screen reader remains the voice of the page.",
      });
      return { state: { ...state, browserVoice: action.value }, effects };
    }
    case "set-search":
      return { state: { ...state, search: action.search }, effects: [] };
    case "jump": {
      const node = nodeById(graph, action.nodeId);
      if (!node) {
        return {
          state,
          effects: [
            { type: "boundary" },
            { type: "announce", channel: "assertive", message: "That node is not in this graph." },
          ],
        };
      }
      if (node.id === state.currentNodeId) {
        return {
          state,
          effects: [
{ type: "tone", graphId: graph.id, nodeId: node.id },
          { type: "announce", channel: "polite", message: `Already at ${node.label}. ${whereYouAre(node, graph, state.verbosity)}` },
          ],
        };
      }
      return {
        state: {
          ...state,
          currentNodeId: node.id,
          arrivedFromId: null,
          walk: [...state.walk, { nodeId: node.id, via: "jump", fromId: current.id }],
        },
        effects: [
          { type: "tone", graphId: graph.id, nodeId: node.id },
          { type: "announce", channel: "polite", message: jumpMessage(node, graph, state.verbosity) },
        ],
      };
    }
    case "travel": {
      const link = linkBetween(graph, current.id, action.toId);
      if (!link || !isNeighbor(graph, current.id, action.toId)) {
        return {
          state,
          effects: [
            { type: "boundary" },
            {
              type: "announce",
              channel: "assertive",
              message: `No connection from ${current.label} to that node. ${connectionCountPhrase(graph, current.id)}.`,
            },
          ],
        };
      }
      return {
        state: {
          ...state,
          currentNodeId: link.node.id,
          arrivedFromId: current.id,
          walk: [...state.walk, { nodeId: link.node.id, via: "travel", fromId: current.id }],
        },
        effects: [
          { type: "glide", graphId: graph.id, fromId: current.id, toId: link.node.id },
          {
            type: "announce",
            channel: "polite",
            message: travelMessage({
              graph,
              from: current,
              link,
              verbosity: state.verbosity,
              wrapped: Boolean(action.wrapped),
              onlyOne: Boolean(action.onlyOne),
              direction: action.direction,
              ambiguousLabel: action.ambiguousLabel,
            }),
          },
          {
            type: "practice",
            event: { type: "travel", fromId: current.id, toId: link.node.id, direction: action.direction },
          },
        ],
      };
    }
    case "step-back": {
      if (state.walk.length <= 1) {
        return {
          state,
          effects: [
            { type: "boundary" },
            { type: "announce", channel: "polite", message: "You are at the beginning of this walk." },
          ],
        };
      }
      const leaving = state.walk[state.walk.length - 1]!;
      const walk = state.walk.slice(0, -1);
      const landed = walk[walk.length - 1]!;
      const from = current;
      const to = nodeById(graph, landed.nodeId) ?? current;
      const traveled = leaving.via === "travel";
      const message = traveled
        ? `Back to ${to.label}. Value ${to.value}. That step followed a connection.`
        : `Back to ${to.label}. Value ${to.value}. That step was a jump, so there is no connection glide.`;
      return {
        state: {
          ...state,
          currentNodeId: to.id,
          arrivedFromId: from.id,
          walk,
        },
        effects: [
          traveled ? { type: "glide", graphId: graph.id, fromId: from.id, toId: to.id } : { type: "tone", graphId: graph.id, nodeId: to.id },
          { type: "announce", channel: "polite", message },
        ],
      };
    }
    case "set-graph": {
      const next = graphById(action.graphId);
      if (next.id === state.graphId) {
        const node = nodeById(next, next.startNodeId) ?? next.nodes[0];
        return {
          state,
          effects: node
            ? [{ type: "announce", channel: "polite", message: `Already on ${next.title}. You are at ${node.label}.` }]
            : [],
        };
      }
      const node = nodeById(next, next.startNodeId) ?? next.nodes[0];
      if (!node) {
        return {
          state,
          effects: [{ type: "announce", channel: "assertive", message: `${next.title} has no nodes.` }],
        };
      }
      return {
        state: {
          ...state,
          graphId: next.id,
          currentNodeId: node.id,
          arrivedFromId: null,
          walk: freshWalk(node.id),
          search: "",
        },
        effects: [
          { type: "stop-audio" },
          { type: "tone", graphId: next.id, nodeId: node.id },
          { type: "announce", channel: "polite", message: graphChangeMessage(next, node) },
          { type: "practice", event: { type: "graph-changed", graphId: next.id } },
        ],
      };
    }
    case "place": {
      const next = graphById(action.graphId);
      const node = nodeById(next, action.nodeId) ?? nodeById(next, next.startNodeId) ?? next.nodes[0];
      if (!node) return { state, effects: [] };
      const effects: Effect[] = [];
      if (action.announcement) {
        effects.push({ type: "announce", channel: "polite", message: action.announcement });
      }
      return {
        state: {
          ...state,
          graphId: next.id,
          currentNodeId: node.id,
          arrivedFromId: null,
          walk: freshWalk(node.id),
          search: "",
        },
        effects,
      };
    }
    case "summary":
      return {
        state,
        effects: [
          { type: "announce", channel: "polite", message: whereYouAre(current, graph, state.verbosity === "terse" ? "standard" : state.verbosity) },
          { type: "practice", event: { type: "summary" } },
        ],
      };
    case "set-tutorial-open":
      return {
        state: { ...state, tutorialOpen: action.open },
        effects: action.quiet
          ? []
          : [
              {
                type: "announce",
                channel: "polite",
                message: action.open
                  ? "Tutorial open. Your saved step is ready."
                  : "Tutorial closed. Your step is saved. Open tutorial brings it back. Escape still stops sound.",
              },
            ],
      };
    case "set-tutorial-step":
      return { state: { ...state, tutorialStep: clampStep(action.step), tutorialOpen: true }, effects: [] };
    case "mark-practice":
      return { state: { ...state, practice: { ...state.practice, [action.id]: action.status } }, effects: [] };
    case "mark-quiz":
      return { state: { ...state, quiz: { ...state.quiz, [action.id]: action.status } }, effects: [] };
    case "set-help":
      return { state: { ...state, helpOpen: action.open }, effects: [] };
    case "boundary":
      return {
        state,
        effects: [
          { type: "boundary" },
          { type: "announce", channel: "polite", message: action.message },
        ],
      };
    default:
      return { state, effects: [] };
  }
}
