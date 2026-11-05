import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { resetSpeechGuard } from "./lib/welcome";

function spoken(): string {
  const synth = window.speechSynthesis as unknown as { utterances: string[] };
  return synth.utterances.join(" ");
}

describe("Audiograph spoken tutorial", () => {
  beforeEach(() => {
    resetSpeechGuard();
    (window.speechSynthesis as unknown as { utterances: string[]; speaking: boolean }).utterances = [];
    (window.speechSynthesis as unknown as { speaking: boolean }).speaking = false;
  });

  it("speaks welcome and every control as soon as the page opens", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Audiograph" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Keyboard controls/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Graph sonification engine/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Audio scan paused.");
    expect(screen.getByLabelText(/Slope m/i)).toHaveValue(2);
    expect(screen.getByLabelText(/Constant c/i)).toHaveValue(3);
    await waitFor(() => expect(spoken()).toMatch(/Welcome to Audiograph/));
    expect(spoken()).toMatch(/Tutorial wizard/);
    expect(spoken()).toMatch(/Play or pause/);
    expect(spoken()).toMatch(/Reset grid/);
    expect(spoken()).not.toMatch(/click|hover|look at the/i);
    expect(screen.getByRole("heading", { name: "Spoken tutorial" })).toBeInTheDocument();
    expect(screen.getByText(/Welcome to Audiograph/)).toBeInTheDocument();
  });

  it("resets with R, focuses slope with X, and loads practice 4 with the number key", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard("r");
    expect(screen.getByLabelText(/Slope m/i)).toHaveValue(0);
    expect(screen.getByLabelText(/Constant c/i)).toHaveValue(0);
    expect(spoken()).toMatch(/Reset/);

    await user.keyboard("x");
    expect(screen.getByLabelText(/Slope m/i)).toHaveFocus();

    await user.keyboard("{Escape}");
    await user.keyboard("4");
    expect(screen.getByLabelText(/Slope m/i)).toHaveValue(0);
    expect(screen.getByLabelText(/Constant c/i)).toHaveValue(5);
    expect(spoken()).toMatch(/Practice 4/);
  });

  it("plays and pauses the scan from the button and from Space", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Play \/ Pause/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Audio scan playing."));
    await user.keyboard(" ");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Audio scan paused."));
  });

  it("repeats the tutorial when H is pressed inside the slope box", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(spoken()).toMatch(/Welcome to Audiograph/));
    const slope = screen.getByLabelText(/Slope m/i);
    slope.focus();
    const before = spoken().length;
    await user.keyboard("h");
    expect(spoken().length).toBeGreaterThan(before);
    expect(slope).toHaveFocus();
  });

  it("replays the tutorial from the tutorial button", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(spoken()).toMatch(/Welcome to Audiograph/));
    const before = spoken().length;
    await user.click(screen.getByRole("button", { name: /Tutorial wizard/i }));
    expect(spoken().length).toBeGreaterThan(before);
    expect(spoken()).toMatch(/Welcome to Audiograph/);
  });
});
