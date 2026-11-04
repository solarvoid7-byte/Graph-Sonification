/** Spoken once, the moment the page is parsed. Not a video. */
export const WELCOME = [
  "Welcome to Audiograph.",
  "You do not need a mouse, and you do not need to see the page.",
  "This voice is the tutorial. It starts by itself as soon as the page opens.",
  "Press Escape to stop this voice. Press H to hear this guide again from the start.",
  "If you also use a screen reader, you will hear this voice and your screen reader.",
  "Press Escape to stop this page voice and use only your screen reader. The same words are written on the page.",
  "The page has two parts, side by side.",
  "The left part is keyboard controls and guided inputs.",
  "The right part is the graph sonification engine.",
  "The right part shows a square grid, a horizontal axis, a vertical axis, and a line.",
  "That picture is optional. The sound is the line.",
  "Left side, from top to bottom.",
  "First, hotkeys. They work when you are not inside a field.",
  "If you are in a field, press Escape to leave it, then press the key.",
  "H plays this tutorial.",
  "Space plays or pauses the audio scan of the line.",
  "If you are already on a button, Space activates that button instead.",
  "The middle button is Play pause.",
  "R resets the equation and the grid to neutral: linear, slope 0, constant 0.",
  "X moves to the slope field.",
  "Y moves to the constant field.",
  "Number keys 1 through 6 load six practice lines.",
  "Second, equation type. It is a list. It starts on Linear equation, y equals m x plus c. Slope times x, plus a constant.",
  "Other choices are Horizontal line, y equals c, and Slope through the center, y equals m x.",
  "With the list focused, Up and Down move, and Enter confirms.",
  "Third, slope m, the steepness. Positive rises as the scan moves right. Negative falls. Zero is flat.",
  "The highest is 10 and the lowest is minus 10. It starts at 2. The X key moves here.",
  "Fourth, constant c, where the line crosses the vertical axis.",
  "The highest is 10 and the lowest is minus 10. It starts at 3. The Y key moves here.",
  "Fifth, three buttons in a row at the bottom of the left side.",
  "Tutorial wizard, also H. Speaks this guide.",
  "Play or pause, also Space. Scans the line from the left edge to the right edge.",
  "Higher on the grid is a higher note. Toward the left is the left ear. Toward the right is the right ear.",
  "Under the grid, the status says audio scan playing, or audio scan paused.",
  "Reset grid, also R. Stops the scan and returns to a flat line on the horizontal axis.",
  "You are starting on slope 2, constant 3. The line rises to the right and crosses the vertical axis at 3.",
  "Press Space to hear that line.",
].join(" ");

export interface Preset {
  key: number;
  slope: number;
  constant: number;
  speech: string;
}

export const PRESETS: Preset[] = [
  { key: 1, slope: 2, constant: 3, speech: "Practice 1. Slope 2, constant 3. The line rises to the right and crosses the vertical axis at 3." },
  { key: 2, slope: 1, constant: 0, speech: "Practice 2. Slope 1, constant 0. The line rises through the center of the grid." },
  { key: 3, slope: -2, constant: 4, speech: "Practice 3. Slope minus 2, constant 4. The line falls to the right and crosses the vertical axis at 4." },
  { key: 4, slope: 0, constant: 5, speech: "Practice 4. Slope 0, constant 5. A flat line above the horizontal axis." },
  { key: 5, slope: 4, constant: -2, speech: "Practice 5. Slope 4, constant minus 2. A steep line that rises to the right." },
  { key: 6, slope: -1, constant: -3, speech: "Practice 6. Slope minus 1, constant minus 3. The line falls to the right and crosses below the center." },
];

let speechLock = false;

export function resetSpeechGuard(): void {
  speechLock = false;
}

export function speakText(text: string, force = false): boolean {
  if (!force && speechLock) return false;
  speechLock = true;
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return false;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.95;
  try {
    synth.cancel();
    synth.speak(utter);
    const keepAlive = window.setInterval(() => {
      if (!synth.speaking) {
        window.clearInterval(keepAlive);
        return;
      }
      try {
        synth.resume();
      } catch {
        window.clearInterval(keepAlive);
      }
    }, 400);
    return true;
  } catch {
    return false;
  }
}

export function speakTutorial(force = false): boolean {
  return speakText(WELCOME, force);
}

export function stopVoice(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Ignore browsers that throw when no utterance is queued.
  }
}
