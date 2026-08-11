import type { FloatingFrameEngine } from "./floating-frame-engine.js";

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isInTextInput(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (INPUT_TAGS.has(active.tagName)) return true;
  if ((active as HTMLElement).isContentEditable) return true;
  const root = active.shadowRoot;
  if (root) {
    const inner = root.activeElement;
    if (inner && (INPUT_TAGS.has(inner.tagName) || (inner as HTMLElement).isContentEditable)) return true;
  }
  return false;
}

export function createFrameKeyboardHandler(
  engine: FloatingFrameEngine,
  container: HTMLElement,
  signal: AbortSignal,
): void {
  let focusedKey: string | null = null;

  container.addEventListener("pages-frame-focus", ((e: Event) => {
    focusedKey = (e as CustomEvent<{ frameKey: string }>).detail.frameKey;
  }) as EventListener, { signal });

  function handleKeydown(e: KeyboardEvent): void {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (isInTextInput()) return;

    const key = e.key;

    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      e.preventDefault();
      const dir = key.replace("Arrow", "").toLowerCase() as "up" | "down" | "left" | "right";
      const target = engine.focusDirection(dir);
      if (target) {
        focusedKey = target;
        engine.bringToFront(target);
      }
      return;
    }

    if (key >= "1" && key <= "9") {
      e.preventDefault();
      const index = parseInt(key) - 1;
      const visible = [...engine.frames.values()].filter(f => !f.hidden).sort((a, b) => a.order - b.order);
      if (index < visible.length) {
        focusedKey = visible[index]!.key;
        engine.bringToFront(focusedKey);
      }
      return;
    }

    if (key === "]" || key === "[") {
      e.preventDefault();
      const visible = [...engine.frames.values()].filter(f => !f.hidden).sort((a, b) => a.order - b.order);
      if (visible.length === 0) return;
      const currentIndex = focusedKey ? visible.findIndex(f => f.key === focusedKey) : -1;
      const next = key === "]"
        ? (currentIndex + 1) % visible.length
        : (currentIndex - 1 + visible.length) % visible.length;
      focusedKey = visible[next]!.key;
      engine.bringToFront(focusedKey);
      return;
    }

    if (key === "w" && focusedKey) {
      e.preventDefault();
      engine.removeFrame(focusedKey);
      focusedKey = null;
      return;
    }

    if (key === "p" && focusedKey) {
      e.preventDefault();
      engine.togglePin(focusedKey);
      return;
    }
  }

  document.addEventListener("keydown", handleKeydown, { signal });
}
