import { useEffect, useRef, useState } from "react";
import type { PracticeStatus, QuizStatus } from "../session/reduce";
import { tutorialSteps, type TutorialStep } from "../lib/tutorial";

interface TutorialPanelProps {
  open: boolean;
  stepIndex: number;
  practice: Record<string, PracticeStatus>;
  quiz: Record<string, QuizStatus>;
  onOpen: () => void;
  onClose: () => void;
  onStep: (index: number) => void;
  onSkipPractice: (id: string) => void;
  onQuizPass: (id: string) => void;
  onAnnounce: (message: string) => void;
  onFinish: () => void;
  onPlayNotes: (firstHz: number, secondHz: number) => void;
  onPlaySide: (pan: number) => void;
}

export function TutorialPanel({
  open,
  stepIndex,
  practice,
  quiz,
  onOpen,
  onClose,
  onStep,
  onSkipPractice,
  onQuizPass,
  onAnnounce,
  onFinish,
  onPlayNotes,
  onPlaySide,
}: TutorialPanelProps) {
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const key = `${open}:${stepIndex}`;
    // The first commit, including React strict mode's second pass, must not
    // steal focus. Focus only after the reader moves to another step.
    if (seen.current === null || seen.current === key) {
      seen.current = key;
      return;
    }
    seen.current = key;
    if (open) stepHeadingRef.current?.focus();
  }, [open, stepIndex]);

  if (!open) {
    return (
      <section aria-labelledby="tutorial-heading" className="panel">
        <h2 id="tutorial-heading" tabIndex={-1}>
          Tutorial
        </h2>
        <p>Closed. Your place is saved at step {stepIndex + 1} of {tutorialSteps.length}.</p>
        <button type="button" onClick={onOpen}>
          Open tutorial
        </button>
      </section>
    );
  }

  const step = tutorialSteps[stepIndex] ?? tutorialSteps[0]!;
  const practiceStatus = practice[step.id] ?? "idle";

  return (
    <section aria-labelledby="tutorial-heading" className="panel">
      <h2 id="tutorial-heading" tabIndex={-1}>
        Tutorial
      </h2>
      <p>
        Written for screen reader and keyboard use. It stays open while you try the real controls. It does not trap
        focus. Next step is never locked.
      </p>
      <div className="row">
        <button type="button" onClick={onClose}>
          Close tutorial
        </button>
        <button
          type="button"
          onClick={() => {
            stepHeadingRef.current?.focus();
          }}
        >
          Move to this step heading
        </button>
        <button
          type="button"
          onClick={() => onAnnounce(stepSpeech(step, stepIndex))}
        >
          Announce this step
        </button>
      </div>

      <h3 id="tutorial-step-heading" ref={stepHeadingRef} tabIndex={-1}>
        Step {stepIndex + 1} of {tutorialSteps.length}: {step.title}
      </h3>
      {step.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 48)}>{paragraph}</p>
      ))}

      {step.practice ? (
        <div className="callout">
          <h4>Try it</h4>
          {step.practice.optional ? <p>This practice is optional.</p> : null}
          <p>{step.practice.instruction}</p>
          <p>
            Practice status:{" "}
            {practiceStatus === "done" ? "complete" : practiceStatus === "skipped" ? "skipped" : "not tried yet"}.
          </p>
          {practiceStatus === "idle" ? (
            <button type="button" onClick={() => onSkipPractice(step.id)}>
              Skip this practice
            </button>
          ) : null}
        </div>
      ) : null}

      {step.quiz?.kind === "choice" ? (
        <ChoiceQuiz
          stepId={step.id}
          question={step.quiz.question}
          options={step.quiz.options}
          correctId={step.quiz.correctId}
          correct={step.quiz.correct}
          incorrect={step.quiz.incorrect}
          passed={quiz[step.id] === "passed"}
          onPass={() => onQuizPass(step.id)}
          onAnnounce={onAnnounce}
        />
      ) : null}

      {step.quiz?.kind === "pitch" ? (
        <PitchQuiz
          stepId={step.id}
          question={step.quiz.question}
          passed={quiz[step.id] === "passed"}
          onPass={() => onQuizPass(step.id)}
          onAnnounce={onAnnounce}
          onPlayNotes={onPlayNotes}
        />
      ) : null}

      {step.quiz?.kind === "side" ? (
        <SideQuiz
          stepId={step.id}
          question={step.quiz.question}
          passed={quiz[step.id] === "passed"}
          onPass={() => onQuizPass(step.id)}
          onAnnounce={onAnnounce}
          onPlaySide={onPlaySide}
        />
      ) : null}

      <div className="row">
        <button
          type="button"
          onClick={() => {
            if (stepIndex === 0) {
              onAnnounce("Already the first step.");
              return;
            }
            onStep(stepIndex - 1);
          }}
        >
          Back step
        </button>
        {stepIndex < tutorialSteps.length - 1 ? (
          <button type="button" onClick={() => onStep(stepIndex + 1)}>
            Next step
          </button>
        ) : (
          <button type="button" onClick={onFinish}>
            Finish tutorial
          </button>
        )}
      </div>

      <details>
        <summary>All steps</summary>
        <ol className="step-list" aria-label="Tutorial steps">
          {tutorialSteps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={index === stepIndex ? "step" : undefined}
                onClick={() => onStep(index)}
              >
                Step {index + 1}: {item.title}
              </button>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

function stepSpeech(step: TutorialStep, index: number): string {
  const parts = [`Step ${index + 1} of ${tutorialSteps.length}. ${step.title}.`, ...step.paragraphs];
  if (step.practice) parts.push(`Practice. ${step.practice.instruction}`);
  if (step.quiz) parts.push(`Question. ${step.quiz.question}`);
  return parts.join(" ");
}

function ChoiceQuiz({
  stepId,
  question,
  options,
  correctId,
  correct,
  incorrect,
  passed,
  onPass,
  onAnnounce,
}: {
  stepId: string;
  question: string;
  options: { id: string; label: string }[];
  correctId: string;
  correct: string;
  incorrect: string;
  passed: boolean;
  onPass: () => void;
  onAnnounce: (message: string) => void;
}) {
  const [choice, setChoice] = useState(options[0]?.id ?? "");
  return (
    <form
      className="callout"
      onSubmit={(event) => {
        event.preventDefault();
        if (choice === correctId) {
          onPass();
          onAnnounce(correct);
        } else {
          onAnnounce(incorrect);
        }
      }}
    >
      <fieldset>
        <legend>{question}</legend>
        {passed ? <p>You already answered this correctly. You can try again if you want.</p> : null}
        {options.map((option) => (
          <label key={option.id} className="choice">
            <input
              type="radio"
              name={`quiz-${stepId}`}
              value={option.id}
              checked={choice === option.id}
              onChange={() => setChoice(option.id)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <button type="submit">Check answer</button>
    </form>
  );
}

function PitchQuiz({
  stepId,
  question,
  passed,
  onPass,
  onAnnounce,
  onPlayNotes,
}: {
  stepId: string;
  question: string;
  passed: boolean;
  onPass: () => void;
  onAnnounce: (message: string) => void;
  onPlayNotes: (firstHz: number, secondHz: number) => void;
}) {
  const [choice, setChoice] = useState<"first" | "second">("first");
  const [higher, setHigher] = useState<"first" | "second" | null>(null);

  return (
    <form
      className="callout"
      onSubmit={(event) => {
        event.preventDefault();
        if (!higher) {
          onAnnounce("Play the two notes first. Then choose which one was higher.");
          return;
        }
        if (choice === higher) {
          onPass();
          onAnnounce("Correct. The higher pitch stands for a larger value. The spoken number is still the exact value.");
        } else {
          onAnnounce(
            `Not quite. The ${higher} note was higher. Play them again if you want another pair. Pitch is the value, and the spoken number stays exact when two notes are hard to tell apart.`,
          );
        }
      }}
    >
      <fieldset>
        <legend>{question}</legend>
        {passed ? <p>You already answered this correctly.</p> : null}
        <button
          type="button"
          onClick={() => {
            const next = Math.random() < 0.5 ? "first" : "second";
            setHigher(next);
            const low = 220;
            const high = 494;
            onPlayNotes(next === "first" ? high : low, next === "first" ? low : high);
            onAnnounce("Playing two notes. The first note plays, then the second.");
          }}
        >
          Play the two notes
        </button>
        <label className="choice">
          <input
            type="radio"
            name={`pitch-${stepId}`}
            checked={choice === "first"}
            onChange={() => setChoice("first")}
          />
          The first note was higher
        </label>
        <label className="choice">
          <input
            type="radio"
            name={`pitch-${stepId}`}
            checked={choice === "second"}
            onChange={() => setChoice("second")}
          />
          The second note was higher
        </label>
      </fieldset>
      <button type="submit">Check answer</button>
    </form>
  );
}

function SideQuiz({
  stepId,
  question,
  passed,
  onPass,
  onAnnounce,
  onPlaySide,
}: {
  stepId: string;
  question: string;
  passed: boolean;
  onPass: () => void;
  onAnnounce: (message: string) => void;
  onPlaySide: (pan: number) => void;
}) {
  const [choice, setChoice] = useState<"left" | "right" | "skip">("left");
  const [played, setPlayed] = useState(false);
  return (
    <form
      className="callout"
      onSubmit={(event) => {
        event.preventDefault();
        if (choice === "skip") {
          onPass();
          onAnnounce("Ear test skipped. The lists and the spoken names do not need headphones.");
          return;
        }
        if (!played) {
          onAnnounce("Play the panned note first, or choose the option to skip the ear test.");
          return;
        }
        if (choice === "left") {
          onPass();
          onAnnounce("Correct. That note was toward the left ear. The name of a node is still spoken either way.");
        } else {
          onAnnounce(
            "That note was toward the left ear. If both ears sounded the same, choose the option to skip the ear test. Speakers often hide the difference.",
          );
        }
      }}
    >
      <fieldset>
        <legend>{question}</legend>
        {passed ? <p>This check is already complete.</p> : null}
        <button
          type="button"
          onClick={() => {
            setPlayed(true);
            onPlaySide(-0.75);
            onAnnounce("Playing a note toward the left ear.");
          }}
        >
          Play the panned note
        </button>
        <label className="choice">
          <input type="radio" name={`side-${stepId}`} checked={choice === "left"} onChange={() => setChoice("left")} />
          Left ear
        </label>
        <label className="choice">
          <input type="radio" name={`side-${stepId}`} checked={choice === "right"} onChange={() => setChoice("right")} />
          Right ear
        </label>
        <label className="choice">
          <input type="radio" name={`side-${stepId}`} checked={choice === "skip"} onChange={() => setChoice("skip")} />
          I am skipping the ear test
        </label>
      </fieldset>
      <button type="submit">Check answer</button>
    </form>
  );
}
