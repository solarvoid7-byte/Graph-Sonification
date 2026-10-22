import { useEffect, useRef, useState } from "react";
import { cancelBrowserSpeech, createAnnouncer, speakBrowser, type Announcer } from "./a11y/announcer";
import { Sonifier } from "./audio/sonifier";
import { HelpDialog } from "./components/HelpDialog";
import { OptionList } from "./components/OptionList";
import { TutorialPanel } from "./components/TutorialPanel";
import { VisualGraph } from "./components/VisualGraph";
import { connectionOptionLabel, nodeOptionLabel, whereYouAre } from "./lib/labels";
import { applyPractice, emptyPracticeMemory, type PracticeEvent, type PracticeMemory } from "./lib/practice";
import { connectionCountPhrase, highestValueNode, linkInDirection, linksFrom, nodeById, playbackPlan, stepLink } from "./lib/graph";
import { volumePercent } from "./lib/pitch";
import { graphById, graphs } from "./lib/samples";
import { tutorialSteps } from "./lib/tutorial";
import type { Direction, GraphData, GraphNode } from "./lib/types";
import { loadSession, reduce, saveSession, type Action, type Effect } from "./session/reduce";

export function App() {
  const [state, setState] = useState(loadSession);
  const [playing, setPlaying] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const playingRef = useRef(false);
  const playToken = useRef(0);
  const practiceMemory = useRef<PracticeMemory>(emptyPracticeMemory());
  const preparedStep = useRef<string | null>(null);
  const helpReturn = useRef<HTMLElement | null>(null);
  const helpWasOpen = useRef(false);
  const lastSearch = useRef("");
  const shellRef = useRef<HTMLDivElement>(null);
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);
  const announcerRef = useRef<Announcer | null>(null);
  const sonifierRef = useRef<Sonifier | null>(null);
  if (!sonifierRef.current) sonifierRef.current = new Sonifier();

  const graph = graphById(state.graphId);
  const current = nodeById(graph, state.currentNodeId) ?? graph.nodes[0] ?? null;

  useEffect(() => {
    if (politeRef.current && assertiveRef.current) {
      announcerRef.current = createAnnouncer(politeRef.current, assertiveRef.current);
    }
    sonifierRef.current?.setVolume(stateRef.current.volume);
    sonifierRef.current?.setMuted(stateRef.current.muted);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (state.helpOpen) shell.setAttribute("inert", "");
    else shell.removeAttribute("inert");
  }, [state.helpOpen]);

  useEffect(() => {
    saveSession(state);
    document.title = `${graphById(state.graphId).title} — Graph Sonification`;
  }, [state]);

  useEffect(() => {
    const onHide = () => {
      if (!document.hidden) return;
      playToken.current += 1;
      playingRef.current = false;
      setPlaying(false);
      sonifierRef.current?.stopAll();
      cancelBrowserSpeech();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    if (!state.tutorialOpen) return;
    let cancel = false;
    const timer = window.setTimeout(() => {
      if (cancel) return;
      const snapshot = stateRef.current;
      const step = tutorialSteps[snapshot.tutorialStep];
      if (!step || preparedStep.current === step.id) return;
      preparedStep.current = step.id;
      practiceMemory.current = emptyPracticeMemory();
      if (step.setup) {
        dispatchAndRun({
          type: "place",
          graphId: step.setup.graphId,
          nodeId: step.setup.nodeId,
          announcement: step.setup.announcement,
        });
      }
      const now = stateRef.current;
      if (
        step.practice?.kind === "sound-enabled" &&
        now.soundEnabled &&
        now.practice[step.id] !== "done" &&
        now.practice[step.id] !== "skipped"
      ) {
        dispatchAndRun({ type: "mark-practice", id: step.id, status: "done" });
        say("polite", "Sound is already on. Practice complete. You can replay the test tone any time.");
      }
    }, 0);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
    // The timer reads the latest session through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tutorialOpen, state.tutorialStep]);

  useEffect(() => {
    if (state.helpOpen) {
      helpWasOpen.current = true;
      return;
    }
    if (!helpWasOpen.current) return;
    helpWasOpen.current = false;
    helpReturn.current?.focus();
    helpReturn.current = null;
    say("polite", "Help closed.");
    // say is stable enough for this open/close edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.helpOpen]);

  useEffect(() => {
    const query = state.search.trim();
    const timer = window.setTimeout(() => {
      if (query === lastSearch.current) return;
      const previous = lastSearch.current;
      lastSearch.current = query;
      if (!query) {
        if (previous) say("polite", "Filter cleared. All nodes are in the list.");
        return;
      }
      const matches = graph.nodes.filter((node) => node.label.toLowerCase().includes(query.toLowerCase()));
      const hidden = current ? !matches.some((node) => node.id === current.id) : false;
      if (matches.length === 0) {
        say("polite", `No nodes match ${query}. Clear the filter to hear every node.`);
        return;
      }
      const noun = matches.length === 1 ? "node matches" : "nodes match";
      const extra = hidden && current ? ` Current node ${current.label} is hidden by the filter. The explorer still uses it.` : "";
      say("polite", `${matches.length} ${noun} ${query}.${extra}`);
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.search, state.graphId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      if (stateRef.current.helpOpen) return;
      if (event.target instanceof HTMLElement && event.target.id === "node-filter") return;
      if ((event.target as HTMLElement | null)?.closest?.("#explorer")) return;
      silence({ userStop: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function say(channel: "polite" | "assertive", message: string) {
    const text = message.trim();
    if (!text) return;
    announcerRef.current?.[channel](text);
    speakBrowser(text, stateRef.current.browserVoice);
  }

  function dispatchAndRun(action: Action) {
    const result = reduce(stateRef.current, action);
    stateRef.current = result.state;
    setState(result.state);
    sonifierRef.current?.setVolume(result.state.volume);
    sonifierRef.current?.setMuted(result.state.muted);
    runEffects(result.effects);
  }

  function registerPractice(event: PracticeEvent): string | null {
    const snapshot = stateRef.current;
    if (!snapshot.tutorialOpen) return null;
    const step = tutorialSteps[snapshot.tutorialStep];
    if (!step?.practice) return null;
    const status = snapshot.practice[step.id];
    if (status === "done" || status === "skipped") return null;
    const outcome = applyPractice(step.practice.kind, event, practiceMemory.current);
    practiceMemory.current = outcome.memory;
    if (!outcome.done) return null;
    const marked = reduce(stateRef.current, { type: "mark-practice", id: step.id, status: "done" });
    stateRef.current = marked.state;
    setState(marked.state);
    return `Practice complete. ${step.practice.success} Next step is available whenever you want it. Focus has not moved.`;
  }

  function runEffects(effects: Effect[]) {
    const polite: string[] = [];
    const assertive: string[] = [];
    for (const effect of effects) {
      if (effect.type === "announce") {
        (effect.channel === "assertive" ? assertive : polite).push(effect.message);
      } else if (effect.type === "practice") {
        const extra = registerPractice(effect.event);
        if (extra) polite.push(extra);
      } else if (effect.type === "tone") {
        void sonifierRef.current?.playNode(graphById(effect.graphId), effect.nodeId);
      } else if (effect.type === "glide") {
        void sonifierRef.current?.playGlide(graphById(effect.graphId), effect.fromId, effect.toId);
      } else if (effect.type === "boundary") {
        void sonifierRef.current?.playBoundary();
      } else if (effect.type === "test-tone") {
        void sonifierRef.current?.playTestTone();
      } else if (effect.type === "stop-audio") {
        playToken.current += 1;
        playingRef.current = false;
        setPlaying(false);
        sonifierRef.current?.stopAll();
        cancelBrowserSpeech();
      }
    }
    if (polite.length) say("polite", polite.join(" "));
    if (assertive.length) say("assertive", assertive.join(" "));
  }

  function silence(options: { userStop: boolean }): boolean {
    const wasPlaying = playingRef.current;
    playToken.current += 1;
    playingRef.current = false;
    setPlaying(false);
    const hadTone = sonifierRef.current?.stopAll() ?? false;
    cancelBrowserSpeech();
    if (!options.userStop) return wasPlaying;
    if (wasPlaying) {
      const extra = registerPractice({ type: "playback-stop" });
      say("polite", ["Playback stopped.", extra].filter(Boolean).join(" "));
      return true;
    }
    if (hadTone) {
      say("polite", "Sound stopped.");
      return true;
    }
    return false;
  }

  function nodeNow(): { graph: GraphData; node: GraphNode } | null {
    const currentGraph = graphById(stateRef.current.graphId);
    const node = nodeById(currentGraph, stateRef.current.currentNodeId);
    if (!node) return null;
    return { graph: currentGraph, node };
  }

  function follow(delta: 1 | -1) {
    silence({ userStop: false });
    const place = nodeNow();
    if (!place) return;
    const result = stepLink(place.graph, place.node.id, stateRef.current.arrivedFromId, delta);
    if (!result.link) {
      dispatchAndRun({
        type: "boundary",
        message: `No connections from ${place.node.label}. Use All nodes to jump, or Step back if you walked here.`,
      });
      return;
    }
    dispatchAndRun({
      type: "travel",
      toId: result.link.node.id,
      wrapped: result.wrapped,
      onlyOne: result.onlyOne,
    });
  }

  function travelDirection(direction: Direction) {
    silence({ userStop: false });
    const place = nodeNow();
    if (!place) return;
    const found = linkInDirection(place.graph, place.node.id, direction);
    if (!found.link) {
      dispatchAndRun({
        type: "boundary",
        message: `No connection ${direction} from ${place.node.label}. ${connectionCountPhrase(place.graph, place.node.id)}.`,
      });
      return;
    }
    dispatchAndRun({
      type: "travel",
      toId: found.link.node.id,
      direction,
      ambiguousLabel: found.ambiguous?.node.label,
    });
  }

  function jump(nodeId: string) {
    silence({ userStop: false });
    dispatchAndRun({ type: "jump", nodeId });
  }

  function stepBack() {
    silence({ userStop: false });
    dispatchAndRun({ type: "step-back" });
  }

  function replayCurrent() {
    const place = nodeNow();
    if (!place) return;
    const snapshot = stateRef.current;
    const blocked = !snapshot.soundEnabled
      ? " Sound is off, so there is no tone. Activate Enable sound."
      : snapshot.muted
        ? " Tones are muted, so there is no tone. Activate Unmute tones."
        : snapshot.volume <= 0.001
          ? " Tone volume is 0 percent, so there is no tone. Raise Tone volume."
          : "";
    if (!blocked) void sonifierRef.current?.playNode(place.graph, place.node.id);
    say("polite", `${place.node.label}. Value ${place.node.value}.${blocked}`);
  }

  async function togglePlayback() {
    if (playingRef.current) {
      silence({ userStop: true });
      return;
    }
    const place = nodeNow();
    if (!place) return;
    const snapshot = stateRef.current;
    if (snapshot.muted) {
      say(
        "assertive",
        "Playback did not start. Tones are muted. Activate Unmute tones, then play again. Announcements stay on either way.",
      );
      return;
    }
    if (snapshot.volume <= 0.001) {
      say("assertive", "Playback did not start. Tone volume is 0 percent. Raise Tone volume, then play again.");
      return;
    }
    let justEnabled = false;
    if (!snapshot.soundEnabled) {
      const ok = (await sonifierRef.current?.ensureStarted()) ?? false;
      if (!ok) {
        dispatchAndRun({ type: "enable-sound", ok: false });
        return;
      }
      dispatchAndRun({ type: "enable-sound", ok: true, quiet: true });
      justEnabled = true;
    }
    const token = ++playToken.current;
    const plan = playbackPlan(place.graph);
    playingRef.current = true;
    setPlaying(true);
    const started = registerPractice({ type: "playback-start" });
    const lead = justEnabled ? "Sound is on." : "";
    say("polite", [lead, plan.description, started].filter(Boolean).join(" "));
    const gap = stateRef.current.announceDuringPlayback ? 1100 : 420;
    for (let index = 0; index < plan.ids.length; index += 1) {
      if (playToken.current !== token) return;
      const id = plan.ids[index]!;
      if (stateRef.current.announceDuringPlayback) {
        const node = nodeById(place.graph, id);
        if (node) say("polite", `${index + 1} of ${plan.ids.length}. ${node.label}. Value ${node.value}.`);
      }
      await sonifierRef.current?.playNode(place.graph, id);
      if (playToken.current !== token) return;
      await wait(gap, () => playToken.current !== token);
    }
    if (playToken.current !== token) return;
    playingRef.current = false;
    setPlaying(false);
    const extra = registerPractice({ type: "playback-stop" });
    say("polite", ["Playback finished.", extra].filter(Boolean).join(" "));
  }

  async function enableFromGesture() {
    const ok = (await sonifierRef.current?.ensureStarted()) ?? false;
    if (!ok) {
      dispatchAndRun({ type: "enable-sound", ok: false });
      return;
    }
    if (stateRef.current.soundEnabled) dispatchAndRun({ type: "replay-test" });
    else dispatchAndRun({ type: "enable-sound", ok: true });
  }

  function onExplorerKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if (key === "ArrowDown" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) follow(1);
      return;
    }
    if (key === "ArrowUp" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) follow(-1);
      return;
    }
    if ((key === "ArrowLeft" || key === "Backspace") && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) stepBack();
      return;
    }
    if (key === "ArrowRight" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      dispatchAndRun({
        type: "boundary",
        message:
          "Right arrow stays put. Down arrow follows the next connection. Hold Shift and press an arrow to travel by direction.",
      });
      return;
    }
    if (event.shiftKey && (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      const direction: Direction =
        key === "ArrowLeft" ? "left" : key === "ArrowRight" ? "right" : key === "ArrowUp" ? "up" : "down";
      travelDirection(direction);
      return;
    }
    if (event.repeat) return;
    if (key === "Enter" || key === "p" || key === "P") {
      event.preventDefault();
      event.stopPropagation();
      replayCurrent();
      return;
    }
    if (key === "s" || key === "S") {
      event.preventDefault();
      event.stopPropagation();
      void togglePlayback();
      return;
    }
    if (key === "m" || key === "M") {
      event.preventDefault();
      event.stopPropagation();
      dispatchAndRun({ type: "set-muted", muted: !stateRef.current.muted });
      return;
    }
    if (key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      jump(graphById(stateRef.current.graphId).startNodeId);
      return;
    }
    if (key === "End") {
      event.preventDefault();
      event.stopPropagation();
      const highest = highestValueNode(graphById(stateRef.current.graphId));
      if (highest) jump(highest.id);
      return;
    }
    if (key === "[" || key === "]") {
      event.preventDefault();
      event.stopPropagation();
      const delta = key === "[" ? -0.1 : 0.1;
      dispatchAndRun({ type: "set-volume", volume: stateRef.current.volume + delta, announce: true });
      return;
    }
    if (key >= "1" && key <= "4") {
      event.preventDefault();
      event.stopPropagation();
      const next = graphs[Number(key) - 1];
      if (!next) return;
      silence({ userStop: false });
      dispatchAndRun({ type: "set-graph", graphId: next.id });
      return;
    }
    if (key === "?" || (key === "/" && event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      openHelp();
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      const stopped = silence({ userStop: true });
      if (stopped) return;
      const selected = document.querySelector<HTMLElement>("#node-list [aria-selected='true']");
      if (selected) {
        selected.focus();
        say("polite", "Left the graph explorer. Browse keys work again. Focus is on the node list.");
        return;
      }
      const filter = document.getElementById("node-filter");
      if (filter instanceof HTMLElement) filter.focus();
      say("polite", "Left the graph explorer. The node list is empty, so focus is in the filter. Escape clears a filter.");
      return;
    }
  }

  function openHelp() {
    const active = document.activeElement;
    helpReturn.current = active instanceof HTMLElement ? active : null;
    dispatchAndRun({ type: "set-help", open: true });
  }

  function finishTutorial() {
    dispatchAndRun({ type: "set-tutorial-open", open: false, quiet: true });
    say(
      "polite",
      "Tutorial finished. Focus is on the graph explorer. Down arrow follows the next connection. Open tutorial brings these steps back.",
    );
    document.getElementById("explorer")?.focus();
  }

  const filtered = graph.nodes.filter((node) => node.label.toLowerCase().includes(state.search.trim().toLowerCase()));
  const links = current ? linksFrom(graph, current.id) : [];
  const summary = current ? whereYouAre(current, graph, state.verbosity) : "This graph has no nodes.";

  return (
    <>
      <div ref={politeRef} id="polite-announcer" className="sr-only" role="status" aria-atomic="true" />
      <div ref={assertiveRef} id="assertive-announcer" className="sr-only" role="alert" aria-atomic="true" />
      <div id="app-shell" ref={shellRef}>
        <a className="skip" href="#sound-heading">
          Skip to sound
        </a>
        <a className="skip" href="#tutorial-heading">
          Skip to tutorial
        </a>
        <a className="skip" href="#explorer">
          Skip to graph explorer
        </a>
        <a className="skip" href="#node-list-heading">
          Skip to all nodes
        </a>
        <a className="skip" href="#help-heading">
          Skip to help
        </a>

        <header className="shell">
          <h1 tabIndex={-1}>Graph Sonification</h1>
          <p className="lede">
            Nodes become musical notes. Connections become pitch glides. Every control works from the keyboard, and the
            tutorial is written for a screen reader. You do not need a mouse.
          </p>
        </header>

        <main className="shell">
          <section aria-labelledby="sound-heading" className="panel">
            <h2 id="sound-heading" tabIndex={-1}>
              Sound
            </h2>
            <p>{state.soundEnabled ? "Sound is on." : "Sound is off until you enable it."}</p>
            <div className="row">
              <button type="button" onClick={() => void enableFromGesture()}>
                {state.soundEnabled ? "Replay test tone" : "Enable sound"}
              </button>
              <button
                type="button"
                aria-pressed={state.muted}
                onClick={() => dispatchAndRun({ type: "set-muted", muted: !state.muted })}
              >
                {state.muted ? "Unmute tones" : "Mute tones"}
              </button>
              <button type="button" onClick={() => void togglePlayback()}>
                {playing ? "Stop playback" : "Play the whole graph"}
              </button>
            </div>
            <label className="field" htmlFor="volume">
              Tone volume, percent
              <input
                id="volume"
                type="range"
                min={0}
                max={100}
                step={5}
                value={volumePercent(state.volume)}
                aria-valuetext={`${volumePercent(state.volume)} percent`}
                onChange={(event) =>
                  dispatchAndRun({ type: "set-volume", volume: Number(event.target.value) / 100, announce: false })
                }
              />
            </label>
            <p>Tone volume is {volumePercent(state.volume)} percent.</p>
          </section>

          <TutorialPanel
            open={state.tutorialOpen}
            stepIndex={state.tutorialStep}
            practice={state.practice}
            quiz={state.quiz}
            onOpen={() => dispatchAndRun({ type: "set-tutorial-open", open: true })}
            onClose={() => {
              dispatchAndRun({ type: "set-tutorial-open", open: false });
              document.getElementById("tutorial-heading")?.focus();
            }}
            onStep={(index) => dispatchAndRun({ type: "set-tutorial-step", step: index })}
            onSkipPractice={(id) => {
              dispatchAndRun({ type: "mark-practice", id, status: "skipped" });
              say("polite", "Practice skipped. You can continue.");
            }}
            onQuizPass={(id) => dispatchAndRun({ type: "mark-quiz", id, status: "passed" })}
            onAnnounce={(message) => say("polite", message)}
            onFinish={finishTutorial}
            onPlayNotes={(first, second) => {
              void sonifierRef.current?.playPair(first, second);
            }}
            onPlaySide={(pan) => void sonifierRef.current?.playCue(440, pan)}
          />

          <section aria-labelledby="graph-heading" className="panel">
            <h2 id="graph-heading" tabIndex={-1}>
              Current graph: {graph.title}
            </h2>
            <p>{graph.about}</p>
            <p>Values are {graph.valueMeaning}.</p>
            {graph.warnings.length > 0 ? (
              <>
                <h3>Data notes</h3>
                <ul>
                  {graph.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <label className="field" htmlFor="graph">
              Graph
              <select
                id="graph"
                value={graph.id}
                onChange={(event) => {
                  silence({ userStop: false });
                  dispatchAndRun({ type: "set-graph", graphId: event.target.value });
                }}
              >
                {graphs.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    {index + 1}. {item.title}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section aria-labelledby="where-heading" className="panel">
            <h2 id="where-heading" tabIndex={-1}>
              Where you are
            </h2>
            <p id="where-text" className="here">
              {current ? current.label : "No node"}
            </p>
            <p>{summary}</p>
            <div className="row">
              <button type="button" onClick={() => dispatchAndRun({ type: "summary" })}>
                Announce where you are
              </button>
              <button type="button" onClick={replayCurrent}>
                Replay tone
              </button>
              <button type="button" onClick={() => current && jump(graph.startNodeId)}>
                Jump to start
              </button>
              <button
                type="button"
                onClick={() => {
                  const highest = highestValueNode(graph);
                  if (highest) jump(highest.id);
                }}
              >
                Jump to highest value
              </button>
              <button type="button" onClick={stepBack}>
                Step back
              </button>
            </div>
          </section>

          <section aria-labelledby="explorer-heading" className="panel">
            <h2 id="explorer-heading">Graph explorer</h2>
            <p id="explorer-help">
              Down and Up follow connections in name order. Left arrow steps back. Shift plus an arrow travels by
              direction. Plain Right arrow stays put. Enter replays the note. Escape stops sound, and a second Escape
              leaves this explorer. Question mark opens help. These letter keys work only while this explorer is focused.
            </p>
            <div
              id="explorer"
              role="application"
              tabIndex={0}
              aria-labelledby="explorer-heading explorer-now"
              aria-describedby="explorer-help"
              onKeyDown={onExplorerKey}
            >
              <span id="explorer-now" className="sr-only">
                {current ? `Current node ${current.label}, value ${current.value}` : "No current node"}
              </span>
              <p aria-hidden="true">{summary}</p>
            </div>
            <div className="groups">
              <fieldset>
                <legend>Follow a connection</legend>
                <div className="row">
                  <button type="button" onClick={() => follow(1)}>
                    Next connection
                  </button>
                  <button type="button" onClick={() => follow(-1)}>
                    Previous connection
                  </button>
                </div>
              </fieldset>
              <fieldset>
                <legend>Travel by direction</legend>
                <div className="row">
                  <button type="button" onClick={() => travelDirection("left")}>
                    Direction left
                  </button>
                  <button type="button" onClick={() => travelDirection("right")}>
                    Direction right
                  </button>
                  <button type="button" onClick={() => travelDirection("up")}>
                    Direction up
                  </button>
                  <button type="button" onClick={() => travelDirection("down")}>
                    Direction down
                  </button>
                </div>
              </fieldset>
            </div>
          </section>

          <section aria-labelledby="node-list-heading" className="panel">
            <h2 id="node-list-heading" tabIndex={-1}>
              All nodes
            </h2>
            <p id="node-list-help">Arrow keys jump between nodes. A jump does not follow a connection, and the announcement says so.</p>
            <label className="field" htmlFor="node-filter">
              Filter nodes by name
              <input
                id="node-filter"
                type="search"
                value={state.search}
                autoComplete="off"
                onChange={(event) => dispatchAndRun({ type: "set-search", search: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (stateRef.current.search) {
                    dispatchAndRun({ type: "set-search", search: "" });
                    return;
                  }
                  silence({ userStop: true });
                }}
              />
            </label>
            {state.search.trim() ? (
              <button type="button" onClick={() => dispatchAndRun({ type: "set-search", search: "" })}>
                Clear filter
              </button>
            ) : null}
            {filtered.length === 0 ? (
              <p id="node-empty" tabIndex={-1}>
                No nodes match this filter.
              </p>
            ) : (
              <OptionList
                id="node-list"
                labelledBy="node-list-heading"
                describedBy="node-list-help"
                items={filtered.map((node) => ({ id: node.id, label: nodeOptionLabel(node, graph, state.verbosity) }))}
                selectedId={current?.id ?? null}
                activateOnArrow
                onActivate={jump}
              />
            )}
          </section>

          <section aria-labelledby="connection-heading" className="panel">
            <h2 id="connection-heading" tabIndex={-1}>
              Connections from {current?.label ?? "nowhere"}
            </h2>
            <p id="connection-help">
              Arrow keys move through the links without traveling. Enter or Space travels to the highlighted link.
            </p>
            {links.length === 0 ? (
              <p tabIndex={-1} id="connection-empty">
                No connections from {current?.label ?? "this node"}. Jump from All nodes, or step back if you walked here.
              </p>
            ) : (
              <OptionList
                id="connection-list"
                labelledBy="connection-heading"
                describedBy="connection-help"
                items={links.map((link) => ({
                  id: link.node.id,
                  label: current ? connectionOptionLabel(link, current, graph, state.verbosity) : link.node.label,
                }))}
                activateOnArrow={false}
                onActivate={(id) => {
                  silence({ userStop: false });
                  dispatchAndRun({ type: "travel", toId: id, onlyOne: links.length === 1 });
                }}
                onHighlight={(id) => {
                  if (!stateRef.current.previewTones || !stateRef.current.soundEnabled) return;
                  void sonifierRef.current?.playNode(graphById(stateRef.current.graphId), id, true);
                }}
              />
            )}
          </section>

          <section aria-labelledby="path-heading" className="panel">
            <h2 id="path-heading">Path you walked</h2>
            {state.walk.length <= 1 ? (
              <p>You have not traveled yet. You started at {current?.label ?? "the start"}.</p>
            ) : (
              <ol>
                {state.walk.map((entry, index) => {
                  const node = nodeById(graph, entry.nodeId);
                  const name = node?.label ?? entry.nodeId;
                  const marker = index === state.walk.length - 1 ? ", current" : "";
                  const via = entry.via === "jump" ? ", jump" : entry.via === "travel" ? ", connection" : ", start";
                  return (
                    <li key={`${entry.nodeId}-${index}`}>
                      {name}
                      {via}
                      {marker}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <p className="note">
            A drawing of the same graph follows for people who can see. It is hidden from screen readers. The lists
            above are the interface.
          </p>
          {current ? <VisualGraph graph={graph} currentId={current.id} onJump={jump} /> : null}

          <section aria-labelledby="settings-heading" className="panel">
            <h2 id="settings-heading">Settings</h2>
            <fieldset>
              <legend>Verbosity</legend>
              {(
                [
                  ["terse", "Short"],
                  ["standard", "Standard"],
                  ["detailed", "Detailed"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="choice">
                  <input
                    type="radio"
                    name="verbosity"
                    checked={state.verbosity === value}
                    onChange={() => dispatchAndRun({ type: "set-verbosity", verbosity: value })}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="choice">
              <input
                type="checkbox"
                checked={state.previewTones}
                onChange={(event) => dispatchAndRun({ type: "set-preview", value: event.target.checked })}
              />
              Preview tones in the connection list
            </label>
            <label className="choice">
              <input
                type="checkbox"
                checked={state.announceDuringPlayback}
                onChange={(event) => dispatchAndRun({ type: "set-announce-playback", value: event.target.checked })}
              />
              Announce each node during playback
            </label>
            <label className="choice">
              <input
                type="checkbox"
                checked={state.browserVoice}
                onChange={(event) => dispatchAndRun({ type: "set-browser-voice", value: event.target.checked })}
              />
              Also speak announcements with the browser voice
            </label>
            <p>Leave browser voice off when you use a screen reader. Otherwise the page talks over it.</p>
          </section>

          <section aria-labelledby="help-heading" className="panel">
            <h2 id="help-heading" tabIndex={-1}>
              Help and shortcuts
            </h2>
            <p>The full key list, the meaning of each tone, and fixes for getting stuck are in the help dialog.</p>
            <button type="button" onClick={openHelp}>
              Open keyboard help
            </button>
          </section>
        </main>
      </div>
      {state.helpOpen ? <HelpDialog onClose={() => dispatchAndRun({ type: "set-help", open: false })} /> : null}
    </>
  );
}

function wait(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    let pulse = 0;
    const timer = window.setTimeout(() => {
      window.clearInterval(pulse);
      resolve();
    }, ms);
    pulse = window.setInterval(() => {
      if (!cancelled()) return;
      window.clearInterval(pulse);
      window.clearTimeout(timer);
      resolve();
    }, 30);
  });
}
