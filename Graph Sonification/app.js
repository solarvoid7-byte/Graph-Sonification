"use strict";

/* Ear-safety limits from the success criteria and product plan.
   Master gain is exactly −6 dB. 10^(−6/20) is about 0.501.
   The plan treats that half-level cap as about 75 dBA. */
const MASTER_DB = -6;
const MASTER_GAIN = 10 ** (MASTER_DB / 20);
const FREQ_MIN = 200;
const FREQ_MAX = 800;
const HUM_FREQ = 100;
const BEEP_FREQ = 800;
const BEEP_SECONDS = 0.05;
const ALERT_FREQ = 400;
const DURATION = 3;
const CURVE_STEPS = 120;

const SOURCE_GAIN = {
  main: 0.45,
  hum: 0.22,
  beep: 0.2,
  alert: 0.28
};

const AXIS_MIN = -10;
const AXIS_MAX = 10;

const $ = (id) => document.getElementById(id);

const form = $("equation-form");
const formErrors = $("form-errors");
const statusEl = $("status");
const previewEl = $("equation-preview");
const captionEl = $("graph-caption");
const playBtn = $("play-btn");
const pauseBtn = $("pause-btn");
const resetBtn = $("reset-btn");
const voiceBtn = $("voice-btn");
const progressEl = $("progress");
const progressBar = $("progress-bar");
const curveEl = $("curve");
const playheadEl = $("playhead");
const axisXEl = $("axis-x");
const axisYEl = $("axis-y");
const linearFields = $("linear-fields");
const quadraticFields = $("quadratic-fields");

let audioContext = null;
let masterGain = null;
let liveOscs = [];
let playbackToken = 0;
let frameHandle = 0;
let state = "idle";
let run = null;
let lastStatus = "";
let starting = false;
let voiceRecognition = null;
let listening = false;
let micToneArmed = false;
let guidePhase = "tutorial";
let speakToken = 0;

const GUIDE = {
  tutorial: "Welcome to Graph Sonification. This page turns a ninth grade graph into sound. The sound moves from left to right. A higher graph makes a higher pitch. A short beep marks an axis crossing. A low hum means the graph is below zero. Pitch stays between 200 and 800 hertz. The whole page works from the keyboard. You do not need a mouse.",
  choose: "Press J for linear equations, and F for quadratic equations.",
  linearX: "Linear selected. Pick your x axis value. Type the number in front of x, then press Enter.",
  linearY: "Now pick your y axis value. Type the constant, then press Enter.",
  quadA: "Quadratic selected. Pick your x squared value. Type a, then press Enter.",
  quadX: "Now pick your x axis value. Type b, then press Enter.",
  quadY: "Now pick your y axis value. Type the constant, then press Enter.",
  ready: "Press Space to start playing, and press Space again to stop playing."
};

function yToFrequency(y) {
  const raw = 500 + 30 * y;
  return Math.min(FREQ_MAX, Math.max(FREQ_MIN, raw));
}

function evaluate(type, coeffs, x) {
  if (type === "linear") {
    return coeffs.m * x + coeffs.c;
  }
  return coeffs.a * x * x + coeffs.b * x + coeffs.c;
}

function formatNum(n) {
  const rounded = Math.round(n * 1000) / 1000;
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

function spokenNumber(n) {
  return formatNum(n);
}

function spokenEquation(type, coeffs) {
  const tail = (value, unit) => {
    if (value === 0) return "";
    const word = value < 0 ? "minus" : "plus";
    return ` ${word} ${spokenNumber(Math.abs(value))}${unit}`;
  };
  if (type === "linear") {
    return `y equals ${spokenNumber(coeffs.m)} x${tail(coeffs.c, "")}`;
  }
  return `y equals ${spokenNumber(coeffs.a)} x squared${tail(coeffs.b, " x")}${tail(coeffs.c, "")}`;
}

function visualEquation(type, coeffs) {
  const signed = (value, body, first) => {
    if (value === 0 && !first) return "";
    const text = body(Math.abs(value));
    if (first) return value < 0 ? `−${text}` : text;
    return value < 0 ? ` − ${text}` : ` + ${text}`;
  };
  if (type === "linear") {
    const slope = coeffs.m === 1 ? "x" : coeffs.m === -1 ? "−x" : `${formatNum(coeffs.m)}x`;
    if (coeffs.c === 0) return `y = ${slope}`;
    const sign = coeffs.c < 0 ? "−" : "+";
    return `y = ${slope} ${sign} ${formatNum(Math.abs(coeffs.c))}`;
  }
  const aText = signed(coeffs.a, (abs) => (abs === 1 ? "x²" : `${formatNum(abs)}x²`), true);
  const bText = coeffs.b === 0 ? "" : signed(coeffs.b, (abs) => (abs === 1 ? "x" : `${formatNum(abs)}x`), false);
  const cText = coeffs.c === 0 ? "" : signed(coeffs.c, (abs) => formatNum(abs), false);
  return `y = ${aText}${bText}${cText}`;
}

function readNumber(id) {
  const el = $(id);
  const text = el.value.trim();
  if (text === "") return { el, empty: true, value: NaN };
  const value = Number(text);
  return { el, empty: false, value };
}

function currentType() {
  const selected = document.querySelector('input[name="equation-type"]:checked');
  return selected ? selected.value : "linear";
}

function bounds() {
  return {
    xMin: readNumber("x-min"),
    xMax: readNumber("x-max"),
    yMin: readNumber("y-min"),
    yMax: readNumber("y-max")
  };
}

function inOpenRange(value, min, max) {
  return Number.isFinite(value) && value > min && value < max;
}

function inClosedRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function validate() {
  const type = currentType();
  const errors = [];
  const reject = (el, message) => {
    errors.push({ el, message });
  };

  let coeffs = null;
  if (type === "linear") {
    const m = readNumber("m");
    const c = readNumber("c-linear");
    if (m.empty || !inOpenRange(m.value, -10, 10)) {
      reject(m.el, "Slope m must be greater than −10 and less than 10.");
    }
    if (c.empty || !inOpenRange(c.value, -10, 10)) {
      reject(c.el, "Constant c must be greater than −10 and less than 10.");
    }
    if (!m.empty && !c.empty && inOpenRange(m.value, -10, 10) && inOpenRange(c.value, -10, 10)) {
      coeffs = { m: m.value, c: c.value };
    }
  } else {
    const a = readNumber("a");
    const b = readNumber("b");
    const c = readNumber("c-quadratic");
    if (a.empty || !inOpenRange(a.value, -5, 5) || a.value === 0) {
      reject(a.el, "Coefficient a must be greater than −5 and less than 5, and cannot be 0.");
    }
    if (b.empty || !inOpenRange(b.value, -10, 10)) {
      reject(b.el, "Coefficient b must be greater than −10 and less than 10.");
    }
    if (c.empty || !inOpenRange(c.value, -10, 10)) {
      reject(c.el, "Constant c must be greater than −10 and less than 10.");
    }
    if (errors.length === 0) {
      coeffs = { a: a.value, b: b.value, c: c.value };
    }
  }

  const axis = bounds();
  const axisFields = [
    ["x-min", axis.xMin, "X-axis start"],
    ["x-max", axis.xMax, "X-axis end"],
    ["y-min", axis.yMin, "Y-axis minimum"],
    ["y-max", axis.yMax, "Y-axis maximum"]
  ];
  /* Limits are open on purpose: m < 10, c < 10, a < 5, b < 10.
     The same distance is blocked below zero so a large negative slope
     cannot slip through. All six test equations sit inside these limits. */
  axisFields.forEach(([, reading, label]) => {
    if (reading.empty || !inClosedRange(reading.value, AXIS_MIN, AXIS_MAX)) {
      reject(reading.el, `${label} must stay from −10 to 10, including the ends.`);
    }
  });
  if (inClosedRange(axis.xMin.value, AXIS_MIN, AXIS_MAX) && inClosedRange(axis.xMax.value, AXIS_MIN, AXIS_MAX) && !(axis.xMin.value < axis.xMax.value)) {
    reject(axis.xMin.el, "X-axis start must be less than x-axis end.");
  }
  if (inClosedRange(axis.yMin.value, AXIS_MIN, AXIS_MAX) && inClosedRange(axis.yMax.value, AXIS_MIN, AXIS_MAX) && !(axis.yMin.value < axis.yMax.value)) {
    reject(axis.yMin.el, "Y-axis minimum must be less than y-axis maximum.");
  }

  const axisOk =
    inClosedRange(axis.xMin.value, AXIS_MIN, AXIS_MAX) &&
    inClosedRange(axis.xMax.value, AXIS_MIN, AXIS_MAX) &&
    inClosedRange(axis.yMin.value, AXIS_MIN, AXIS_MAX) &&
    inClosedRange(axis.yMax.value, AXIS_MIN, AXIS_MAX) &&
    axis.xMin.value < axis.xMax.value &&
    axis.yMin.value < axis.yMax.value;

  return {
    ok: Boolean(coeffs) && axisOk && errors.length === 0,
    errors,
    type,
    coeffs,
    xMin: axis.xMin.value,
    xMax: axis.xMax.value,
    yMin: axis.yMin.value,
    yMax: axis.yMax.value
  };
}

function clearFieldErrors() {
  document.querySelectorAll("input[aria-invalid]").forEach((input) => {
    input.removeAttribute("aria-invalid");
  });
  formErrors.textContent = "";
}

function showErrors(errors) {
  clearFieldErrors();
  errors.forEach((error) => {
    error.el.setAttribute("aria-invalid", "true");
  });
  const unique = [];
  errors.forEach((error) => {
    if (!unique.includes(error.message)) unique.push(error.message);
  });
  formErrors.textContent = unique.join(" ");
  if (errors[0]) errors[0].el.focus();
}

function setStatus(message) {
  if (message === lastStatus) return;
  lastStatus = message;
  statusEl.textContent = message;
}

function setPlayButton(label) {
  playBtn.textContent = label;
  playBtn.setAttribute("aria-label", label);
}

function setProgress(fraction, text) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const percent = Math.round(clamped * 100);
  progressEl.setAttribute("aria-valuenow", String(percent));
  progressEl.setAttribute("aria-valuetext", text);
  progressBar.style.width = `${percent}%`;
}

function hidePlayhead() {
  playheadEl.setAttribute("visibility", "hidden");
}

const PLOT = { left: 48, right: 600, top: 28, bottom: 392 };

function mapX(x, xMin, xMax) {
  const span = xMax - xMin || 1;
  return PLOT.left + ((x - xMin) / span) * (PLOT.right - PLOT.left);
}

function mapY(y, yMin, yMax) {
  const span = yMax - yMin || 1;
  const clamped = Math.min(yMax, Math.max(yMin, y));
  return PLOT.bottom - ((clamped - yMin) / span) * (PLOT.bottom - PLOT.top);
}

function setGraphLabel(id, text, x, y) {
  const el = $(id);
  el.textContent = text;
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
}

function axisReady(model) {
  return Boolean(
    model &&
    Number.isFinite(model.xMin) &&
    Number.isFinite(model.xMax) &&
    Number.isFinite(model.yMin) &&
    Number.isFinite(model.yMax) &&
    model.xMin < model.xMax &&
    model.yMin < model.yMax &&
    model.xMin >= AXIS_MIN &&
    model.xMax <= AXIS_MAX &&
    model.yMin >= AXIS_MIN &&
    model.yMax <= AXIS_MAX
  );
}

function drawGraph(model) {
  const usable = axisReady(model);
  const xMin = usable ? model.xMin : AXIS_MIN;
  const xMax = usable ? model.xMax : AXIS_MAX;
  const yMin = usable ? model.yMin : AXIS_MIN;
  const yMax = usable ? model.yMax : AXIS_MAX;
  const yZero = Math.min(yMax, Math.max(yMin, 0));
  const xZero = Math.min(xMax, Math.max(xMin, 0));
  axisXEl.setAttribute("x1", String(PLOT.left));
  axisXEl.setAttribute("x2", String(PLOT.right));
  axisXEl.setAttribute("y1", String(mapY(yZero, yMin, yMax)));
  axisXEl.setAttribute("y2", String(mapY(yZero, yMin, yMax)));
  axisYEl.setAttribute("y1", String(PLOT.top));
  axisYEl.setAttribute("y2", String(PLOT.bottom));
  axisYEl.setAttribute("x1", String(mapX(xZero, xMin, xMax)));
  axisYEl.setAttribute("x2", String(mapX(xZero, xMin, xMax)));
  setGraphLabel("label-x-min", formatNum(xMin), PLOT.left, 436);
  setGraphLabel("label-x-max", formatNum(xMax), PLOT.right - 36, 436);
  setGraphLabel("label-y-max", formatNum(yMax), 8, PLOT.top + 8);
  setGraphLabel("label-y-min", formatNum(yMin), 8, PLOT.bottom + 4);

  if (!usable || !model.coeffs) {
    curveEl.setAttribute("points", "");
    captionEl.textContent = "Enter a valid equation to draw the graph.";
    if (!model || !model.coeffs) {
      previewEl.textContent = "No equation yet. Enter values, or load a test equation below.";
    }
    return;
  }

  const points = [];
  let outsideSafe = false;
  for (let i = 0; i <= 200; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / 200;
    const y = evaluate(model.type, model.coeffs, x);
    if (y < AXIS_MIN || y > AXIS_MAX) outsideSafe = true;
    points.push(`${mapX(x, xMin, xMax)},${mapY(y, yMin, yMax)}`);
  }
  curveEl.setAttribute("points", points.join(" "));
  const equation = visualEquation(model.type, model.coeffs);
  previewEl.textContent = equation;
  captionEl.textContent = outsideSafe
    ? `${equation}. Part of the graph leaves y = −10 to 10, so the pitch holds at 200 or 800 hertz there.`
    : `${equation}, from x = ${formatNum(xMin)} to x = ${formatNum(xMax)}.`;
}

function placePlayhead(fraction, model) {
  const x = model.xMin + (model.xMax - model.xMin) * fraction;
  const px = mapX(x, model.xMin, model.xMax);
  playheadEl.setAttribute("visibility", "visible");
  playheadEl.setAttribute("x1", String(px));
  playheadEl.setAttribute("x2", String(px));
  playheadEl.setAttribute("y1", String(PLOT.top));
  playheadEl.setAttribute("y2", String(PLOT.bottom));
}

function refreshForm(announceMode) {
  const type = currentType();
  const linear = type === "linear";
  linearFields.hidden = !linear;
  quadraticFields.hidden = linear;
  linearFields.querySelectorAll("input").forEach((input) => {
    input.disabled = !linear;
  });
  quadraticFields.querySelectorAll("input").forEach((input) => {
    input.disabled = linear;
  });
  const model = validate();
  if (model.ok) {
    clearFieldErrors();
    drawGraph(model);
  } else if (model.coeffs && model.errors.every((error) => ["x-min", "x-max", "y-min", "y-max"].includes(error.el.id))) {
    drawGraph({ ...model, coeffs: null });
    previewEl.textContent = visualEquation(type, model.coeffs);
  } else {
    const partial = model.coeffs ? model : { ...model, coeffs: null };
    drawGraph(partial.coeffs ? partial : null);
    if (!model.coeffs) {
      previewEl.textContent = "No equation yet. Enter values, or load a test equation below.";
    }
  }
  if (announceMode) {
    setStatus(linear ? "Linear equation selected." : "Quadratic equation selected.");
  }
}

async function audioReady() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("This browser has no Web Audio support.");
  }
  if (!audioContext) {
    audioContext = new AudioCtx();
    masterGain = audioContext.createGain();
    masterGain.gain.value = MASTER_GAIN;
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
}

function trackOsc(osc) {
  liveOscs.push(osc);
  return osc;
}

function stopLiveOscs() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  liveOscs.forEach((osc) => {
    try {
      osc.stop(now);
    } catch (err) {
      /* already stopped */
    }
    try {
      osc.disconnect();
    } catch (err) {
      /* already disconnected */
    }
  });
  liveOscs = [];
}

function stopFrame() {
  cancelAnimationFrame(frameHandle);
  frameHandle = 0;
}

async function playTone(frequency, seconds, gainValue, wave) {
  const ctx = await audioReady();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave || "sine";
  osc.frequency.value = frequency;
  gain.gain.value = gainValue;
  osc.connect(gain);
  gain.connect(masterGain);
  const start = ctx.currentTime + 0.02;
  osc.start(start);
  osc.stop(start + seconds);
}

async function playAlert() {
  try {
    await playTone(ALERT_FREQ, 0.18, SOURCE_GAIN.alert, "sine");
  } catch (err) {
    setStatus(err.message);
  }
}

function scheduleBeep(time) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "square";
  osc.frequency.value = BEEP_FREQ;
  gain.gain.value = SOURCE_GAIN.beep;
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + BEEP_SECONDS);
  trackOsc(osc);
}

function signsCross(a, b) {
  return (a < 0 && b >= 0) || (a > 0 && b <= 0);
}

function scheduleGraph(model, fromFraction) {
  const ctx = audioContext;
  const startFraction = Math.min(0.98, Math.max(0, fromFraction));
  const audioStart = ctx.currentTime + 0.06;
  const samples = [];
  for (let i = 0; i <= CURVE_STEPS; i += 1) {
    const local = i / CURVE_STEPS;
    const fraction = startFraction + (1 - startFraction) * local;
    const x = model.xMin + (model.xMax - model.xMin) * fraction;
    const y = evaluate(model.type, model.coeffs, x);
    samples.push({
      t: audioStart + DURATION * (fraction - startFraction),
      fraction,
      x,
      y,
      freq: yToFrequency(y)
    });
  }

  const main = ctx.createOscillator();
  const mainGain = ctx.createGain();
  main.type = "sine";
  mainGain.gain.value = SOURCE_GAIN.main;
  main.connect(mainGain);
  mainGain.connect(masterGain);
  main.frequency.setValueAtTime(samples[0].freq, samples[0].t);
  for (let i = 1; i < samples.length; i += 1) {
    const time = Math.max(samples[i].t, samples[i - 1].t + 0.001);
    main.frequency.exponentialRampToValueAtTime(samples[i].freq, time);
  }
  main.start(samples[0].t);
  main.stop(samples[samples.length - 1].t + 0.02);
  trackOsc(main);

  const hum = ctx.createOscillator();
  const humGain = ctx.createGain();
  hum.type = "sine";
  hum.frequency.value = HUM_FREQ;
  hum.connect(humGain);
  humGain.connect(masterGain);
  humGain.gain.setValueAtTime(samples[0].y < 0 ? SOURCE_GAIN.hum : 0.0001, samples[0].t);
  for (let i = 1; i < samples.length; i += 1) {
    const time = Math.max(samples[i].t, samples[i - 1].t + 0.001);
    const level = samples[i].y < 0 ? SOURCE_GAIN.hum : 0.0001;
    humGain.gain.exponentialRampToValueAtTime(level, time);
  }
  hum.start(samples[0].t);
  hum.stop(samples[samples.length - 1].t + 0.02);
  trackOsc(hum);

  if (Math.abs(samples[0].x) < 1e-6 || Math.abs(samples[0].y) < 1e-6) {
    scheduleBeep(samples[0].t);
  }
  let lastBeep = samples[0].t;
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    const crossed = signsCross(prev.x, next.x) || signsCross(prev.y, next.y);
    if (crossed && next.t - lastBeep > BEEP_SECONDS) {
      scheduleBeep(next.t);
      lastBeep = next.t;
    }
  }

  const token = playbackToken;
  main.onended = () => {
    if (token !== playbackToken) return;
    finishPlayback();
  };

  return {
    model,
    audioStart,
    startFraction,
    lastSecond: -1,
    lastYSign: Math.sign(samples[0].y),
    lastXSign: Math.sign(samples[0].x),
    sawOutside: false
  };
}

function fractionNow() {
  if (!run || !audioContext) return run ? run.startFraction : 0;
  const elapsed = audioContext.currentTime - run.audioStart;
  return Math.min(1, run.startFraction + elapsed / DURATION);
}

function tick() {
  if (state !== "playing" || !run) return;
  const fraction = fractionNow();
  const model = run.model;
  const x = model.xMin + (model.xMax - model.xMin) * fraction;
  const y = evaluate(model.type, model.coeffs, x);
  placePlayhead(fraction, model);
  setProgress(fraction, `x ${formatNum(x)}, y ${formatNum(y)}, ${Math.round(yToFrequency(y))} hertz`);

  const ySign = Math.sign(y);
  const xSign = Math.sign(x);
  const crossedY = (run.lastYSign >= 0 && y < 0) || (run.lastYSign <= 0 && y > 0);
  const crossedX = (run.lastXSign >= 0 && x < 0) || (run.lastXSign <= 0 && x > 0);
  if (crossedY) {
    const hum = y < 0 ? " Low hum is on." : " Low hum is off.";
    setStatus(`Crossing the x-axis at x ${formatNum(x)}. Pitch ${Math.round(yToFrequency(y))} hertz.${hum}`);
  } else if (crossedX) {
    setStatus(`Crossing the y-axis. y is ${formatNum(y)}. Pitch ${Math.round(yToFrequency(y))} hertz.`);
  } else if (y === 0 && run.lastYSign < 0) {
    setStatus("Graph is back at zero. Low hum is off.");
  } else {
    const second = Math.floor((fraction - run.startFraction) * DURATION);
    if (second !== run.lastSecond && second >= 0) {
      run.lastSecond = second;
      setStatus(`x ${formatNum(x)}, y ${formatNum(y)}, pitch ${Math.round(yToFrequency(y))} hertz.`);
    }
  }
  run.lastYSign = ySign;
  run.lastXSign = xSign;
  if (y < AXIS_MIN || y > AXIS_MAX) run.sawOutside = true;

  if (fraction < 1) frameHandle = requestAnimationFrame(tick);
}

async function startPlayback(fromFraction) {
  if (starting) return;
  starting = true;
  try {
    const model = validate();
    if (!model.ok) {
      showErrors(model.errors);
      setStatus("Input blocked. Fix the highlighted box.");
      await playAlert();
      return;
    }
    clearFieldErrors();
    speakToken += 1;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    try {
      await audioReady();
    } catch (err) {
      setStatus(err.message);
      return;
    }
    playbackToken += 1;
    stopLiveOscs();
    stopFrame();
    drawGraph(model);
    run = scheduleGraph(model, fromFraction);
    state = "playing";
    pauseBtn.disabled = false;
    setPlayButton("Play graph sound");
    const spoken = spokenEquation(model.type, model.coeffs);
    const outsideNote = captionEl.textContent.includes("holds")
      ? " Part of the graph is outside the safe height, so the pitch will hold at the limit."
      : "";
    setStatus(fromFraction > 0.01 ? `Resumed. ${spoken}.` : `Playing ${spoken}.${outsideNote}`);
    frameHandle = requestAnimationFrame(tick);
  } finally {
    starting = false;
  }
}

function playGraph() {
  if (state === "paused" && run) {
    startPlayback(run.resumeFraction || 0);
    return;
  }
  startPlayback(0);
}

function pauseGraph() {
  if (state !== "playing" || !run || !audioContext) {
    setStatus("Nothing is playing.");
    return;
  }
  run.resumeFraction = fractionNow();
  playbackToken += 1;
  stopLiveOscs();
  stopFrame();
  state = "paused";
  pauseBtn.disabled = true;
  setPlayButton("Resume graph sound");
  const stopped = `Stopped at ${progressEl.getAttribute("aria-valuetext")}. Press Space to start playing again.`;
  setStatus(stopped);
  speak("Stopped. Press Space to start playing again.");
}

function finishPlayback() {
  if (state !== "playing") return;
  stopFrame();
  state = "finished";
  pauseBtn.disabled = true;
  setPlayButton("Play graph sound");
  setProgress(1, "Playback finished");
  if (run) placePlayhead(1, run.model);
  setStatus("Playback finished.");
  run = null;
}

function resetGrid() {
  playbackToken += 1;
  stopLiveOscs();
  stopFrame();
  state = "idle";
  run = null;
  pauseBtn.disabled = true;
  setPlayButton("Play graph sound");
  setProgress(0, "Not playing");
  hidePlayhead();
  form.reset();
  $("type-linear").checked = true;
  $("x-min").value = "-10";
  $("x-max").value = "10";
  $("y-min").value = "-10";
  $("y-max").value = "10";
  clearFieldErrors();
  refreshForm(false);
  guidePhase = "choose";
  speak(GUIDE.choose);
  $("tutorial").focus();
}

function loadExample(button) {
  const type = button.getAttribute("data-type");
  playbackToken += 1;
  stopLiveOscs();
  stopFrame();
  state = "idle";
  run = null;
  pauseBtn.disabled = true;
  setPlayButton("Play graph sound");
  setProgress(0, "Not playing");
  hidePlayhead();
  if (type === "linear") {
    $("type-linear").checked = true;
    $("m").value = button.getAttribute("data-m");
    $("c-linear").value = button.getAttribute("data-c");
  } else {
    $("type-quadratic").checked = true;
    $("a").value = button.getAttribute("data-a");
    $("b").value = button.getAttribute("data-b");
    $("c-quadratic").value = button.getAttribute("data-c");
  }
  clearFieldErrors();
  refreshForm(false);
  const model = validate();
  if (model.ok) {
    guidePhase = "ready";
    speak(`Loaded ${spokenEquation(model.type, model.coeffs)}. ${GUIDE.ready}`);
  }
}

function setGuideText(text) {
  $("tutorial").textContent = text;
}

let heldUtterance = null;
let tutorialHeard = false;

function englishVoice(synth) {
  const voices = synth.getVoices();
  return voices.find((voice) => /^en(-|_)?/i.test(voice.lang)) || null;
}

function speak(text, onend) {
  setGuideText(text);
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance !== "function") {
    if (onend) onend();
    return;
  }
  const token = ++speakToken;
  let tries = 0;
  const launch = () => {
    if (token !== speakToken) return;
    const utter = new SpeechSynthesisUtterance(text);
    heldUtterance = utter;
    utter.lang = "en-US";
    utter.rate = 0.95;
    utter.volume = 1;
    const voice = englishVoice(synth);
    if (voice) utter.voice = voice;
    let started = false;
    utter.onstart = () => {
      started = true;
      if (text === GUIDE.tutorial) tutorialHeard = true;
    };
    utter.onend = () => {
      if (token !== speakToken || !started) return;
      if (onend) onend();
    };
    utter.onerror = () => {
      if (token !== speakToken) return;
      if (started) {
        if (onend) onend();
        return;
      }
      if (tries >= 4) return;
      tries += 1;
      window.setTimeout(() => {
        if (token !== speakToken || tutorialHeard) return;
        launch();
      }, 200);
    };
    synth.speak(utter);
    try { synth.resume(); } catch (err) { /* already running */ }
  };
  if (synth.speaking || synth.pending) {
    synth.cancel();
    window.setTimeout(launch, 80);
  } else {
    try { synth.resume(); } catch (err) { /* already running */ }
    launch();
  }
}

function valueIsOk(reading, min, max, allowZero) {
  if (reading.empty || !inOpenRange(reading.value, min, max)) return false;
  if (!allowZero && reading.value === 0) return false;
  return true;
}

function rejectValue(input, message) {
  input.setAttribute("aria-invalid", "true");
  input.focus();
  speak(message);
  playAlert();
}

function chooseLinear() {
  playbackToken += 1;
  stopLiveOscs();
  stopFrame();
  state = "idle";
  run = null;
  pauseBtn.disabled = true;
  setPlayButton("Play graph sound");
  $("type-linear").checked = true;
  refreshForm(false);
  guidePhase = "linear-x";
  $("m").focus();
  speak(GUIDE.linearX);
}

function chooseQuadratic() {
  playbackToken += 1;
  stopLiveOscs();
  stopFrame();
  state = "idle";
  run = null;
  pauseBtn.disabled = true;
  setPlayButton("Play graph sound");
  $("type-quadratic").checked = true;
  refreshForm(false);
  guidePhase = "quad-a";
  $("a").focus();
  speak(GUIDE.quadA);
}

function confirmStep() {
  if (guidePhase === "tutorial") return;
  if (guidePhase === "linear-x") {
    const reading = readNumber("m");
    if (!valueIsOk(reading, -10, 10, true)) {
      rejectValue($("m"), "That x value will not work. Type a number greater than minus 10 and less than 10, then press Enter.");
      return;
    }
    $("m").removeAttribute("aria-invalid");
    guidePhase = "linear-y";
    $("c-linear").focus();
    speak(GUIDE.linearY);
    return;
  }
  if (guidePhase === "linear-y") {
    const reading = readNumber("c-linear");
    if (!valueIsOk(reading, -10, 10, true)) {
      rejectValue($("c-linear"), "That y value will not work. Type a number greater than minus 10 and less than 10, then press Enter.");
      return;
    }
    $("c-linear").removeAttribute("aria-invalid");
    refreshForm(false);
    guidePhase = "ready";
    speak(GUIDE.ready);
    return;
  }
  if (guidePhase === "quad-a") {
    const reading = readNumber("a");
    if (!valueIsOk(reading, -5, 5, false)) {
      rejectValue($("a"), "That x squared value will not work. Type a number greater than minus 5 and less than 5, not zero, then press Enter.");
      return;
    }
    $("a").removeAttribute("aria-invalid");
    guidePhase = "quad-x";
    $("b").focus();
    speak(GUIDE.quadX);
    return;
  }
  if (guidePhase === "quad-x") {
    const reading = readNumber("b");
    if (!valueIsOk(reading, -10, 10, true)) {
      rejectValue($("b"), "That x value will not work. Type a number greater than minus 10 and less than 10, then press Enter.");
      return;
    }
    $("b").removeAttribute("aria-invalid");
    guidePhase = "quad-y";
    $("c-quadratic").focus();
    speak(GUIDE.quadY);
    return;
  }
  if (guidePhase === "quad-y") {
    const reading = readNumber("c-quadratic");
    if (!valueIsOk(reading, -10, 10, true)) {
      rejectValue($("c-quadratic"), "That y value will not work. Type a number greater than minus 10 and less than 10, then press Enter.");
      return;
    }
    $("c-quadratic").removeAttribute("aria-invalid");
    refreshForm(false);
    guidePhase = "ready";
    speak(GUIDE.ready);
    return;
  }
  speak(currentGuideLine());
}

function currentGuideLine() {
  if (guidePhase === "tutorial") return GUIDE.tutorial;
  if (guidePhase === "choose") return GUIDE.choose;
  if (guidePhase === "linear-x") return GUIDE.linearX;
  if (guidePhase === "linear-y") return GUIDE.linearY;
  if (guidePhase === "quad-a") return GUIDE.quadA;
  if (guidePhase === "quad-x") return GUIDE.quadX;
  if (guidePhase === "quad-y") return GUIDE.quadY;
  return GUIDE.ready;
}

function togglePlayback() {
  if (guidePhase === "tutorial") return;
  if (guidePhase !== "ready") {
    speak(currentGuideLine());
    return;
  }
  if (state === "playing") pauseGraph();
  else playGraph();
}

function startTutorial() {
  if (tutorialHeard || guidePhase !== "tutorial") return;
  speak(GUIDE.tutorial, () => {
    if (guidePhase !== "tutorial") return;
    guidePhase = "choose";
    speak(GUIDE.choose);
  });
}

function bootTutorial() {
  const synth = window.speechSynthesis;
  let armed = false;
  const begin = () => {
    if (armed || tutorialHeard || guidePhase !== "tutorial") return;
    if (synth && synth.getVoices().length === 0) return;
    armed = true;
    startTutorial();
  };
  if (synth) {
    synth.getVoices();
    synth.addEventListener("voiceschanged", begin);
  }
  begin();
  window.setTimeout(() => {
    if (armed || tutorialHeard || guidePhase !== "tutorial") return;
    armed = true;
    startTutorial();
  }, 300);
  window.addEventListener("load", () => {
    if (!tutorialHeard && guidePhase === "tutorial" && !(synth && synth.speaking)) {
      armed = false;
      begin();
    }
  });
  let kicks = 0;
  const kick = window.setInterval(() => {
    kicks += 1;
    if (!synth || tutorialHeard || kicks > 20) {
      window.clearInterval(kick);
      return;
    }
    try { synth.resume(); } catch (err) { /* already running */ }
  }, 250);
}

async function playMicOffTone() {
  if (!micToneArmed) return;
  micToneArmed = false;
  try {
    await audioReady();
    const ctx = audioContext;
    const start = ctx.currentTime + 0.02;
    [0, 0.12].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(SOURCE_GAIN.beep, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.04);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(start + offset);
      osc.stop(start + offset + 0.05);
    });
  } catch (err) {
    setStatus(err.message);
  }
}

function handleVoiceTranscript(transcript) {
  const word = transcript.trim().toLowerCase().replace(/[.!?,\s]+/g, " ").trim();
  if (word === "play") {
    setStatus("Voice command: play.");
    playGraph();
    return;
  }
  if (word === "pause") {
    setStatus("Voice command: pause.");
    pauseGraph();
    return;
  }
  if (word === "reset") {
    setStatus("Voice command: reset.");
    resetGrid();
    return;
  }
  if (word) {
    setStatus(`Heard “${transcript.trim()}”. Say play, pause, or reset.`);
  }
}

function ensureRecognition() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  if (!voiceRecognition) {
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (last && last.isFinal) handleVoiceTranscript(last[0].transcript);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      listening = false;
      voiceBtn.setAttribute("aria-pressed", "false");
      voiceBtn.textContent = "Start voice commands";
      voiceBtn.setAttribute("aria-label", "Start voice commands");
      if (event.error === "not-allowed") {
        setStatus("Microphone permission was blocked. Use Tab, Space, and Enter instead.");
      } else {
        setStatus("Voice commands stopped. Use the keyboard.");
      }
    };
    recognition.onend = () => {
      if (listening) {
        try {
          recognition.start();
        } catch (err) {
          listening = false;
        }
        return;
      }
      playMicOffTone();
    };
    voiceRecognition = recognition;
  }
  return voiceRecognition;
}

function toggleVoice() {
  const recognition = ensureRecognition();
  if (!recognition) {
    setStatus("Voice commands are not available in this browser. Use Tab, Space, and Enter.");
    return;
  }
  if (listening) {
    listening = false;
    micToneArmed = true;
    voiceBtn.setAttribute("aria-pressed", "false");
    voiceBtn.textContent = "Start voice commands";
    voiceBtn.setAttribute("aria-label", "Start voice commands");
    setStatus("Voice commands off.");
    try {
      recognition.stop();
    } catch (err) {
      playMicOffTone();
    }
    return;
  }
  listening = true;
  voiceBtn.setAttribute("aria-pressed", "true");
  voiceBtn.textContent = "Stop voice commands";
  voiceBtn.setAttribute("aria-label", "Stop voice commands");
  setStatus("Listening.");
  speak("Listening");
  try {
    recognition.start();
  } catch (err) {
    listening = false;
    voiceBtn.setAttribute("aria-pressed", "false");
    voiceBtn.textContent = "Start voice commands";
    setStatus("Could not open the microphone. Use the keyboard.");
  }
}

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const key = event.key.toLowerCase();
  const onButton = event.target.tagName === "BUTTON" || event.target.tagName === "A";
  if (key === "j") {
    event.preventDefault();
    chooseLinear();
    return;
  }
  if (key === "f") {
    event.preventDefault();
    chooseQuadratic();
    return;
  }
  if (event.key === " " || event.code === "Space") {
    event.preventDefault();
    togglePlayback();
    return;
  }
  if (event.key === "Enter") {
    if (onButton) return;
    event.preventDefault();
    confirmStep();
  }
});

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", () => refreshForm(false));
form.addEventListener("change", (event) => {
  if (event.target.name === "equation-type") refreshForm(true);
});

document.querySelectorAll('input[type="number"]').forEach((input) => {
  input.addEventListener("wheel", (event) => {
    if (document.activeElement === input) event.preventDefault();
  }, { passive: false });
});

playBtn.addEventListener("click", playGraph);
pauseBtn.addEventListener("click", pauseGraph);
resetBtn.addEventListener("click", resetGrid);
voiceBtn.addEventListener("click", toggleVoice);
document.querySelectorAll(".example").forEach((button) => {
  button.addEventListener("click", () => loadExample(button));
});

refreshForm(false);
bootTutorial();
setInterval(() => {
  const synth = window.speechSynthesis;
  if (!synth || !synth.speaking) return;
  synth.pause();
  synth.resume();
}, 8000);
