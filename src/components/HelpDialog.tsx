import { useEffect, useRef } from "react";
import { focusableElements } from "../a11y/focus";

interface HelpDialogProps {
  onClose: () => void;
}

export function HelpDialog({ onClose }: HelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function" && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute("open", "");
      }
    }
    headingRef.current?.focus();
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = focusableElements(dialog);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="help-dialog-title"
      aria-modal="true"
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button type="button" onClick={onClose}>
        Close help
      </button>
      <h2 id="help-dialog-title" ref={headingRef} tabIndex={-1}>
        Keyboard help
      </h2>
      <p>
        Every action in the table also has a button. Letter keys work only inside the graph explorer, so they do not
        take over your screen reader’s browse keys.
      </p>

      <h3>Anywhere on the page</h3>
      <table>
        <caption>Keys that work outside the graph explorer</caption>
        <thead>
          <tr>
            <th scope="col">Key</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tab</td>
            <td>Next control</td>
          </tr>
          <tr>
            <td>Shift+Tab</td>
            <td>Previous control</td>
          </tr>
          <tr>
            <td>Enter or Space</td>
            <td>Activate the button or option you are on</td>
          </tr>
          <tr>
            <td>Escape</td>
            <td>Stop tones. If this dialog is open, Escape closes it first. Escape does not close the tutorial.</td>
          </tr>
          <tr>
            <td>Up and Down in a list</td>
            <td>Move between nodes or connections</td>
          </tr>
        </tbody>
      </table>

      <h3>Inside the graph explorer</h3>
      <p>Focus the explorer, then use these keys. Press Escape once to stop sound. Press Escape again to leave.</p>
      <table>
        <caption>Keys that work when the graph explorer is focused</caption>
        <thead>
          <tr>
            <th scope="col">Key</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Down Arrow</td>
            <td>Next connection in name order, and travel there</td>
          </tr>
          <tr>
            <td>Up Arrow</td>
            <td>Previous connection in name order, and travel there</td>
          </tr>
          <tr>
            <td>Left Arrow or Backspace</td>
            <td>Step back along the walk you took</td>
          </tr>
          <tr>
            <td>Right Arrow</td>
            <td>Stay put. Reminds you that direction needs Shift</td>
          </tr>
          <tr>
            <td>Shift+Arrow</td>
            <td>Travel toward that direction: left, right, up, or down</td>
          </tr>
          <tr>
            <td>Enter or P</td>
            <td>Replay the current note and name</td>
          </tr>
          <tr>
            <td>S</td>
            <td>Play or stop the whole graph</td>
          </tr>
          <tr>
            <td>M</td>
            <td>Mute or unmute tones</td>
          </tr>
          <tr>
            <td>Home</td>
            <td>Jump to the start node</td>
          </tr>
          <tr>
            <td>End</td>
            <td>Jump to the highest value</td>
          </tr>
          <tr>
            <td>1 through 4</td>
            <td>Switch graphs, in the same order as the Graph select</td>
          </tr>
          <tr>
            <td>[ and ]</td>
            <td>Quieter and louder</td>
          </tr>
          <tr>
            <td>Question mark</td>
            <td>Open this help</td>
          </tr>
        </tbody>
      </table>

      <h3>What the tones mean</h3>
      <ul>
        <li>Steady note: a node. Low pitch is a small value. High pitch is a large value.</li>
        <li>A soft higher chime on top of a note: this node is the start of the graph.</li>
        <li>A longer note: the node has more connections. A very short note: it has none.</li>
        <li>Glide up: you traveled to a higher value. Glide down: a lower value.</li>
        <li>Two equal taps: the value did not change.</li>
        <li>Two low pulses: that move is not available. You stay where you are.</li>
        <li>Left and right ears follow the layout. The note is never placed fully in one ear.</li>
      </ul>

      <h3>If something goes wrong</h3>
      <ul>
        <li>No sound: activate Enable sound. Check Tone volume and Mute tones. Then Replay test tone.</li>
        <li>Sound stuck on: press Escape.</li>
        <li>Browse keys stopped: you are inside the graph explorer. Press Escape to leave.</li>
        <li>Holding a key floods the page: the explorer ignores key repeat. Press once per move.</li>
        <li>A node disappeared from All nodes: clear the filter. Escape does that when the filter has focus.</li>
        <li>Two voices: turn off Also speak announcements with the browser voice.</li>
        <li>Lost: activate Announce where you are, or read the Where you are heading.</li>
        <li>You took a wrong step: Step back. Jumps and connections are both undone.</li>
        <li>Directed course graph: “along the arrow” moves to a later course. “Against the arrow” moves back to a requirement. A course with nothing onward can still walk back.</li>
      </ul>

      <h3>Words</h3>
      <dl>
        <dt>Node</dt>
        <dd>One place in the graph. It has a name and a value.</dd>
        <dt>Connection</dt>
        <dd>A link you can travel. Jumping from All nodes can skip these, and the announcement says so.</dd>
        <dt>Glide</dt>
        <dd>The pitch slide you hear while traveling a connection.</dd>
        <dt>Value</dt>
        <dd>The number that sets the pitch. The current graph heading says what the number means.</dd>
      </dl>
      <button type="button" onClick={onClose}>
        Close help
      </button>
    </dialog>
  );
}
