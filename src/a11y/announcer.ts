export interface Announcer {
  polite(message: string): void;
  assertive(message: string): void;
  clear(): void;
}

/**
 * Permanent live regions.
 * Messages fired in the same moment are joined into one utterance so a
 * follow-up does not erase the sentence before the screen reader starts.
 * A repeated call later still speaks, because the region is cleared first.
 */
export function createAnnouncer(politeEl: HTMLElement, assertiveEl: HTMLElement): Announcer {
  const polite = channel(politeEl);
  const assertive = channel(assertiveEl);
  return {
    polite: polite.push,
    assertive: assertive.push,
    clear() {
      polite.cancel();
      assertive.cancel();
      politeEl.textContent = "";
      assertiveEl.textContent = "";
    },
  };
}

function channel(element: HTMLElement): { push: (message: string) => void; cancel: () => void } {
  let buffer = "";
  let token = 0;
  let outerTimer: number | null = null;
  let innerTimer: number | null = null;

  return {
    push(message: string) {
      const text = message.trim();
      if (!text) return;
      buffer = buffer ? `${buffer} ${text}` : text;
      if (outerTimer !== null) window.clearTimeout(outerTimer);
      if (innerTimer !== null) window.clearTimeout(innerTimer);
      const mine = ++token;
      outerTimer = window.setTimeout(() => {
        outerTimer = null;
        const spoken = buffer;
        buffer = "";
        element.textContent = "";
        innerTimer = window.setTimeout(() => {
          innerTimer = null;
          if (mine !== token) return;
          element.textContent = spoken;
        }, 30);
      }, 30);
    },
    cancel() {
      token += 1;
      buffer = "";
      if (outerTimer !== null) window.clearTimeout(outerTimer);
      if (innerTimer !== null) window.clearTimeout(innerTimer);
      outerTimer = null;
      innerTimer = null;
    },
  };
}

export function speakBrowser(message: string, enabled: boolean): void {
  if (!enabled) return;
  const synthesis = window.speechSynthesis;
  if (!synthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  const text = message.trim();
  if (!text) return;
  try {
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    synthesis.speak(utterance);
  } catch {
    // The live region still carries the message when synthesis is unavailable.
  }
}

export function cancelBrowserSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Ignore engines that throw when nothing is speaking.
  }
}
