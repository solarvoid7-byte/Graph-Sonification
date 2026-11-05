/** Spoken once, the moment the page is parsed. Not a video. */
export const WELCOME = [
  "Welcome to Audiograph.",
  "Press Escape to stop this voice. Press H any time, even while you are typing a number, to hear this guide again.",
  "You do not need a mouse, and you do not need to see the page.",
  "This voice is the tutorial. It starts by itself as soon as the page opens.",
  "If you also use a screen reader, press Escape and use only your screen reader. The same words are written on the page.",
  "There are two areas. First, the controls. Second, the sound of the line. A picture of the grid is also on the page, and you can ignore that picture.",
  "H is the Tutorial wizard. It speaks this guide.",
  "Space plays or pauses the line. If you are already on a button, Space presses that button. The middle button is Play pause.",
  "R is Reset grid. It makes a flat line, slope 0, constant 0.",
  "X moves to the slope box. Y moves to the constant box. Number keys 1 through 6 load practice lines.",
  "The equation list starts on a straight line, y equals m x plus c.",
  "You can also choose a horizontal line, a line through the center, or a sine wave. Sine uses radians, the same way a calculator does. For a sine wave, slope is how tall the wave is.",
  "Slope is how steep a straight line is. Positive goes up as the sound moves to the right. Negative goes down. Zero is flat.",
  "The highest number is 10 and the lowest is minus 10. Slope starts at 2. Constant starts at 3. Constant is the height where the line crosses the vertical axis.",
  "Play or pause reads the line from left to right. Higher on the grid is a higher note. The left side is the left ear. The right side is the right ear.",
  "A short tick marks each grid line. A brighter tick is the vertical axis, where x is 0. That moment is the y-intercept.",
  "A low tick means the line crossed the horizontal axis, where y is 0. That moment is the x-intercept.",
  "If the line leaves the grid, the note stays at the highest or lowest pitch. It does not get louder.",
  "The status line says audio scan playing, or audio scan paused.",
  "You are starting on slope 2, constant 3. The line rises and crosses the vertical axis at 3.",
  "At the far left, that line is below the grid, so the first note stays at the lowest pitch until the line comes back on. That is expected. It does not mean the sound is broken.",
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
  try {
    synth.cancel();
    const parts = text.split(/(?<=\.)\s+/).filter((part) => part.trim().length > 0);
    for (const part of parts) {
      const utter = new SpeechSynthesisUtterance(part);
      utter.lang = "en-US";
      utter.rate = 0.92;
      synth.speak(utter);
    }
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
