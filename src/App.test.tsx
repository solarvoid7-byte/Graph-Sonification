import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

function announcer(): string {
  return document.getElementById("polite-announcer")?.textContent ?? "";
}

function here(): string {
  return document.querySelector(".here")?.textContent ?? "";
}

describe("keyboard-only graph sonification", () => {
  it("opens on a tutorial that can be moved through without a mouse", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Graph Sonification" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to graph explorer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Step 1 of 13/ })).toBeInTheDocument();
    expect(document.querySelector(".drawing")).toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByRole("button", { name: "Back step" }));
    await waitFor(() => expect(announcer()).toMatch(/Already the first step/));
    await user.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("heading", { name: /Step 2 of 13: Turn sound on/ })).toBeInTheDocument();
  });

  it("checks a quiz only when the answer is submitted", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("radio", { name: "Escape" }));
    await user.click(screen.getByRole("radio", { name: "Tab" }));
    expect(announcer()).not.toMatch(/Correct/);
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await waitFor(() => expect(announcer()).toMatch(/Correct/));
  });

  it("enables sound, travels by name and by direction, and stops at an isolated node", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Enable sound" }));
    await waitFor(() => expect(announcer()).toMatch(/Sound is on/));
    expect(screen.getByRole("button", { name: "Replay test tone" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Direction right" }));
    expect(here()).toBe("Store");

    await user.click(screen.getByRole("button", { name: "Jump to start" }));
    expect(here()).toBe("Home");
    await user.click(screen.getByRole("button", { name: "Next connection" }));
    expect(here()).toBe("Bus Stop");
    await user.click(screen.getByRole("button", { name: "Step back" }));
    expect(here()).toBe("Home");

    const nodes = screen.getByRole("listbox", { name: "All nodes" });
    await user.click(within(nodes).getByRole("option", { name: /Notice Board/ }));
    expect(here()).toBe("Notice Board");
    await user.click(screen.getByRole("button", { name: "Next connection" }));
    expect(here()).toBe("Notice Board");
    await waitFor(() => expect(announcer()).toMatch(/No connections from Notice Board/));
  });

  it("keeps letter keys out of buttons and the filter, and uses them inside the explorer", async () => {
    const user = userEvent.setup();
    render(<App />);
    screen.getByRole("button", { name: "Mute tones" }).focus();
    await user.keyboard("m");
    expect(screen.getByRole("button", { name: "Mute tones" })).toBeInTheDocument();

    const filter = screen.getByRole("searchbox", { name: "Filter nodes by name" });
    await user.click(filter);
    await user.keyboard("m");
    expect(screen.getByRole("button", { name: "Mute tones" })).toBeInTheDocument();
    expect(filter).toHaveValue("m");
    await user.keyboard("{Escape}");
    expect(filter).toHaveValue("");

    const explorer = screen.getByRole("application");
    explorer.focus();
    await user.keyboard("m");
    expect(screen.getByRole("button", { name: "Unmute tones" })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(here()).toBe("Bus Stop");
  });

  it("closes help with Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<App />);
    const help = screen.getByRole("button", { name: "Open keyboard help" });
    await user.click(help);
    const dialog = await screen.findByRole("dialog", { name: "Keyboard help" });
    expect(within(dialog).getByRole("table", { name: /outside the graph explorer/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(help).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches graphs from the select and stops playback from the same button", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Graph" }), "temperatures");
    await waitFor(() => expect(here()).toBe("Monday"));
    await user.click(screen.getByRole("button", { name: "Play the whole graph" }));
    const stop = await screen.findByRole("button", { name: "Stop playback" });
    await user.click(stop);
    await waitFor(() => expect(announcer()).toMatch(/Playback stopped/));
    expect(screen.getByRole("button", { name: "Play the whole graph" })).toBeInTheDocument();
  });
});
