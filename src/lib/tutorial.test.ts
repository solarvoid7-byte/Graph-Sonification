import { describe, expect, it } from "vitest";
import { tutorialSteps } from "./tutorial";

const banned = /\b(click|hover|mouseover|look at|see the|as shown|blue button|red button)\b/i;

describe("tutorial language", () => {
  it("never tells someone to click, hover, or look at the picture", () => {
    for (const step of tutorialSteps) {
      const quizText =
        step.quiz && "options" in step.quiz ? step.quiz.options.map((option) => option.label).join(" ") : "";
      const text = [step.title, ...step.paragraphs, step.practice?.instruction ?? "", step.quiz?.question ?? "", quizText].join(
        "\n",
      );
      expect(text, step.id).not.toMatch(banned);
    }
  });

  it("says the mouse is unnecessary and keeps a way out of every step", () => {
    expect(tutorialSteps[0]?.paragraphs.join(" ")).toMatch(/do not need a mouse/i);
    expect(tutorialSteps.some((step) => step.paragraphs.join(" ").includes("Next step is always available"))).toBe(true);
    expect(tutorialSteps.at(-1)?.title).toMatch(/explore/i);
  });
});
