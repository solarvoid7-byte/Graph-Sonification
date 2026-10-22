import { useEffect, useRef, useState } from "react";

export interface OptionItem {
  id: string;
  label: string;
}

interface OptionListProps {
  id: string;
  labelledBy: string;
  describedBy?: string;
  items: OptionItem[];
  /** Mirror of the current node. When omitted, the list keeps its own highlight. */
  selectedId?: string | null;
  /** Arrow keys activate immediately. Otherwise arrows highlight and Enter activates. */
  activateOnArrow: boolean;
  onActivate: (id: string) => void;
  onHighlight?: (id: string) => void;
}

export function OptionList({
  id,
  labelledBy,
  describedBy,
  items,
  selectedId,
  activateOnArrow,
  onActivate,
  onHighlight,
}: OptionListProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buffer = useRef("");
  const bufferTimer = useRef<number | null>(null);
  const focusedInside = useRef(false);
  const signature = items.map((item) => item.id).join("|");
  const signatureRef = useRef(signature);
  const [highlight, setHighlight] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (selectedId && items.some((item) => item.id === selectedId)) {
      setHighlight(selectedId);
      return;
    }
    if (!activateOnArrow) setHighlight(items[0]?.id ?? "");
    // Signature covers item identity. `items` is read from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, selectedId, activateOnArrow]);

  const activeId =
    selectedId && items.some((item) => item.id === selectedId)
      ? selectedId
      : items.some((item) => item.id === highlight)
        ? highlight
        : (items[0]?.id ?? "");

  useEffect(() => {
    const root = rootRef.current;
    const signatureChanged = signatureRef.current !== signature;
    signatureRef.current = signature;
    const insideNow = Boolean(root?.contains(document.activeElement));
    if (!insideNow && !(signatureChanged && focusedInside.current)) return;
    if (document.activeElement?.getAttribute("data-option-id") === activeId) return;
    root?.querySelector<HTMLElement>(`[data-option-id="${escapeId(activeId)}"]`)?.focus();
  }, [activeId, signature]);

  function focusOption(nextId: string) {
    window.requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>(`[data-option-id="${escapeId(nextId)}"]`)?.focus();
    });
  }

  function choose(nextId: string, activate: boolean) {
    setHighlight(nextId);
    if (activate) onActivate(nextId);
    else onHighlight?.(nextId);
    focusOption(nextId);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (items.length === 0) return;
    const index = items.findIndex((item) => item.id === activeId);
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      let next = index < 0 ? 0 : index;
      if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % items.length;
      if (event.key === "ArrowUp") next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = items.length - 1;
      const item = items[next];
      if (!item) return;
      if (item.id === activeId && !activateOnArrow) return;
      choose(item.id, activateOnArrow);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      const item = items.find((entry) => entry.id === activeId) ?? items[0];
      if (item) onActivate(item.id);
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      buffer.current = `${buffer.current}${event.key}`.toLowerCase();
      if (bufferTimer.current !== null) window.clearTimeout(bufferTimer.current);
      bufferTimer.current = window.setTimeout(() => {
        buffer.current = "";
      }, 700);
      const start = Math.max(0, index);
      const ordered = [...items.slice(start + 1), ...items.slice(0, start + 1)];
      const found = ordered.find((item) => item.label.toLowerCase().startsWith(buffer.current));
      if (found) choose(found.id, activateOnArrow);
    }
  }

  return (
    <div
      id={id}
      ref={rootRef}
      role="listbox"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onFocus={() => {
        focusedInside.current = true;
      }}
      onBlur={() => {
        window.setTimeout(() => {
          focusedInside.current = Boolean(rootRef.current?.contains(document.activeElement));
        }, 0);
      }}
    >
      {items.map((item, index) => {
        const selected = item.id === activeId;
        return (
          <div
            key={item.id}
            role="option"
            data-option-id={item.id}
            aria-selected={selected}
            aria-posinset={index + 1}
            aria-setsize={items.length}
            tabIndex={selected || (index === 0 && !activeId) ? 0 : -1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(item.id, true)}
          >
            {selected ? <span aria-hidden="true">Selected. </span> : null}
            {item.label}
          </div>
        );
      })}
    </div>
  );
}

function escapeId(id: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(id);
  return id.replace(/"/g, "");
}
