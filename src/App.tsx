import { useEffect, useRef, useState } from "react";
import { LineScanner, parseParam, yValue, type EquationKind } from "./audio/scan";
import { Plot } from "./components/Plot";
import { PRESETS, WELCOME, speakText, speakTutorial, stopVoice } from "./lib/welcome";

const KINDS: { id: EquationKind; label: string }[] = [
  { id: "linear", label: "Linear Equation (y = mx + c)" },
  { id: "horizontal", label: "Horizontal line (y = c)" },
  { id: "slope", label: "Slope through the center (y = mx)" },
];

function kindSpeech(kind: EquationKind): string {
  if (kind === "horizontal") return "Equation type, horizontal line. Height is the constant. Slope is not used.";
  if (kind === "slope") return "Equation type, slope through the center. The line crosses the center. Constant is not used.";
  return "Equation type, linear. y equals slope times x, plus the constant.";
}

export function App() {
  const [kind, setKind] = useState<EquationKind>("linear");
  const [slopeText, setSlopeText] = useState("2");
  const [constantText, setConstantText] = useState("3");
  const [status, setStatus] = useState("Audio scan paused.");
  const [scanX, setScanX] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [backup, setBackup] = useState(false);
  const scanner = useRef<LineScanner | null>(null);
  if (!scanner.current) scanner.current = new LineScanner();
  const slopeRef = useRef<HTMLInputElement>(null);
  const constantRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef(kind);
  const slopeValueRef = useRef(2);
  const constantValueRef = useRef(3);
  kindRef.current = kind;
  slopeValueRef.current = parseParam(slopeText);
  constantValueRef.current = parseParam(constantText);

  useEffect(() => {
    speakTutorial(false);
    const timer = window.setTimeout(() => {
      const synth = window.speechSynthesis;
      if (!synth || !synth.speaking) setBackup(true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = Boolean(target?.closest("input, textarea, select"));
      if (event.key === "Escape") {
        event.preventDefault();
        stopVoice();
        scanner.current?.stop();
        setPlaying(false);
        setScanX(null);
        setStatus("Audio scan paused.");
        if (typing) target?.blur();
        speakText("Stopped. The tutorial voice is off and the audio scan is paused. Press H to hear the tutorial again. Press Space to play the line.", true);
        return;
      }
      if (typing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (event.key === " ") {
        if (target?.closest("button, a")) return;
        event.preventDefault();
        void toggleScan();
        return;
      }
      if (key === "h") {
        event.preventDefault();
        replayTutorial();
        return;
      }
      if (key === "r") {
        event.preventDefault();
        resetGrid();
        return;
      }
      if (key === "x") {
        event.preventDefault();
        slopeRef.current?.focus();
        slopeRef.current?.select();
        speakText("Slope field. Type a number from minus 10 to 10. Escape leaves this field.", true);
        return;
      }
      if (key === "y") {
        event.preventDefault();
        constantRef.current?.focus();
        constantRef.current?.select();
        speakText("Constant field. Type a number from minus 10 to 10. Escape leaves this field.", true);
        return;
      }
      if (key >= "1" && key <= "6") {
        event.preventDefault();
        loadPreset(Number(key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The key handler calls the function declarations below. Refs hold the live equation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function replayTutorial() {
    stopVoice();
    scanner.current?.stop();
    setPlaying(false);
    setScanX(null);
    setStatus("Audio scan paused.");
    speakText(WELCOME, true);
  }

  function resetGrid() {
    scanner.current?.stop();
    setPlaying(false);
    setScanX(null);
    setKind("linear");
    setSlopeText("0");
    setConstantText("0");
    setStatus("Audio scan paused.");
    speakText("Reset. Linear equation, slope 0, constant 0. The line lies on the horizontal axis. Audio scan paused.", true);
  }

  function loadPreset(key: number) {
    const preset = PRESETS.find((item) => item.key === key);
    if (!preset) return;
    scanner.current?.stop();
    setPlaying(false);
    setScanX(null);
    setKind("linear");
    setSlopeText(String(preset.slope));
    setConstantText(String(preset.constant));
    setStatus("Audio scan paused.");
    speakText(preset.speech, true);
  }

  async function toggleScan() {
    if (scanner.current?.playing) {
      scanner.current.stop();
      setPlaying(false);
      setScanX(null);
      setStatus("Audio scan paused.");
      speakText("Audio scan paused.", true);
      return;
    }
    stopVoice();
    const started = await scanner.current?.start({
      yAt: (x) => yValue(kindRef.current, slopeValueRef.current, constantValueRef.current, x),
      onPosition: (x) => setScanX(x),
      onEnd: () => {
        setPlaying(false);
        setScanX(null);
        setStatus("Audio scan paused.");
        speakText("Audio scan finished. The line was read from the left edge to the right edge.", true);
      },
    });
    if (!started) {
      setStatus("Audio scan paused.");
      speakText("This browser could not start the audio scan. The grid and the numbers still work. Press Space to try again.", true);
      return;
    }
    setPlaying(true);
    setStatus("Audio scan playing.");
    speakText("Audio scan playing. Higher on the grid is a higher note. Left edge is the left ear.", true);
  }

  function commitSlope(raw: string) {
    const next = String(parseParam(raw));
    if (next === slopeText) return;
    setSlopeText(next);
    speakText(`Slope is ${next}. Highest is 10 and lowest is minus 10.`, true);
  }

  function commitConstant(raw: string) {
    const next = String(parseParam(raw));
    if (next === constantText) return;
    setConstantText(next);
    speakText(`Constant is ${next}. Highest is 10 and lowest is minus 10.`, true);
  }

  const slope = parseParam(slopeText);
  const constant = parseParam(constantText);

  return (
    <>
      <div id="assertive-announcer" className="sr-only" role="alert" aria-atomic="true">
        {backup ? WELCOME : ""}
      </div>
      <a className="skip" href="#play-scan">
        Skip to play pause
      </a>
      <h1 className="sr-only">Audiograph</h1>
      <div className="layout">
        <section className="panel" aria-labelledby="controls-title">
          <h2 id="controls-title">Keyboard controls &amp; guided inputs</h2>
          <div className="box">
            <p className="hotkey-title">Hotkeys (Zero Mouse Required):</p>
            <ul>
              <li>Press H: Play Audio Tutorial &amp; Start Guided Setup Wizard</li>
              <li>Press Spacebar: Play or Pause Audio Graph Scan</li>
              <li>Press R: Reset Equations &amp; Grid to Neutral</li>
              <li>Press X: Jump directly to X-Axis / Slope Input</li>
              <li>Press Y: Jump directly to Y-Axis / Constant Input</li>
              <li>Press Keys 1-6: Instantly load target test equations</li>
            </ul>
          </div>

          <label className="field" htmlFor="equation-type">
            Select Equation Type
            <select
              id="equation-type"
              value={kind}
              onChange={(event) => {
                const next = event.target.value as EquationKind;
                setKind(next);
                speakText(kindSpeech(next), true);
              }}
            >
              {KINDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>
              {kind === "horizontal"
                ? "Horizontal line parameters"
                : kind === "slope"
                  ? "Slope parameters"
                  : "Linear Equation Parameters"}
            </legend>
            <label className="field" htmlFor="slope">
              Slope m (X-Axis Code) [Max Limit: 10]
              <input
                id="slope"
                ref={slopeRef}
                type="number"
                inputMode="decimal"
                min={-10}
                max={10}
                step={1}
                value={slopeText}
                onChange={(event) => setSlopeText(event.target.value)}
                onBlur={(event) => commitSlope(event.target.value)}
              />
            </label>
            <label className="field" htmlFor="constant">
              Constant c (Y-Axis Code) [Max Limit: 10]
              <input
                id="constant"
                ref={constantRef}
                type="number"
                inputMode="decimal"
                min={-10}
                max={10}
                step={1}
                value={constantText}
                onChange={(event) => setConstantText(event.target.value)}
                onBlur={(event) => commitConstant(event.target.value)}
              />
            </label>
          </fieldset>

          <div className="actions">
            <button type="button" onClick={replayTutorial}>
              Tutorial wizard
              <span>(H)</span>
            </button>
            <button id="play-scan" type="button" aria-pressed={playing} onClick={() => void toggleScan()}>
              Play / Pause
              <span>(Space)</span>
            </button>
            <button type="button" onClick={resetGrid}>
              Reset grid
              <span>(R)</span>
            </button>
          </div>
        </section>

        <section className="panel" aria-labelledby="engine-title">
          <h2 id="engine-title">Graph sonification engine</h2>
          <div className="plot-frame">
            <Plot kind={kind} slope={slope} constant={constant} scanX={scanX} />
          </div>
          <p id="scan-status" className="status" role="status" aria-atomic="true">
            {status}
          </p>
          <p className="sr-only">
            Picture of the grid for people who can see. Slope {slope}. Constant {constant}. The audio scan describes the line. You do not need the picture.
          </p>
        </section>
      </div>
      <section className="transcript" aria-labelledby="transcript-title">
        <h2 id="transcript-title">Spoken tutorial</h2>
        <p>{WELCOME}</p>
      </section>
    </>
  );
}
