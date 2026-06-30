# Terminal Component Design

**Issue:** casehubio/casehub-pages#80
**Date:** 2026-06-30
**Cross-ref:** Follows the `hostPanel()` + `configure()` Web Component pattern from the workbench primitives spec (casehub-pages#64). Consumed by the claudony adoption design (claudony#161).

## Context

xterm.js terminal emulation is needed across CaseHub host apps (claudony, drafthouse, devtown). Currently claudony implements terminal rendering as a standalone HTML page with vanilla JS (`session.html` + `terminal.js`), bypassing the pages component system entirely. This creates duplication when other apps need terminal functionality.

Driven by casehubio/claudony#161 (adopt casehub-pages).

## Decision

Add `@casehubio/pages-component-terminal` — a Web Component (custom element) that wraps xterm.js with managed WebSocket lifecycle, mounted via `hostPanel()`.

### Why Web Component, not iframe

- xterm.js needs direct DOM access and manages its own rendering
- Terminal WebSocket is a raw bidirectional text stream, not the structured JSON data pipeline that iframe components use (`ComponentController` / `ComponentApi` / postMessage bridge)
- No benefit from iframe isolation — terminal is already a privileged surface
- `hostPanel()` creates custom elements via `document.createElement(tagName)` and calls `configure(panelProps)` — this IS the Web Component path
- The workbench primitives spec (casehub-pages#64) establishes Web Components via `hostPanel()` + `configure()` as the standard component pattern; the iframe+React approach (used by llm-prompter, svg-heatmap) is legacy

### Why no Shadow DOM

The workbench primitives spec explicitly allows both Shadow DOM and light DOM: "hostPanel hosts external Web Components that may or may not use Shadow DOM" (§Event Bus). The terminal uses light DOM because xterm.js creates its own complex DOM structure and manages its own CSS. Shadow DOM would complicate CSS loading (xterm.css would need to be injected into each shadow root) and interfere with xterm.js's own DOM management.

### Why component owns the WebSocket

- xterm.js does NOT own WebSocket connections — `AttachAddon` receives an already-created `WebSocket` and wires bidirectional piping (literally `socket.onmessage → terminal.write()` and `terminal.onData → socket.send()`)
- Terminal dimensions (`cols`, `rows`) are only known after mount + fit — consumer can't construct a dimension-aware URL before the component exists
- URL template with `{cols}` and `{rows}` placeholders solves this: component replaces them after fitting, before connecting
- Component handles reconnection internally (exponential backoff, re-evaluates template with current dimensions)

## Props Interface

```typescript
interface TerminalProps {
  wsUrl: string;            // Supports {cols} and {rows} placeholders
  fontSize?: number;        // default 14
  fontFamily?: string;      // default "Menlo, Monaco, Consolas, monospace"
  scrollback?: number;      // default 5000
  cursorBlink?: boolean;    // default true
  theme?: {
    foreground?: string;
    background?: string;
    cursor?: string;
    selectionBackground?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
  };
}
```

All props are serializable (strings, numbers, booleans, plain objects). Works with both YAML page definitions and programmatic DSL.

`fitToContainer` from the original issue is dropped — fitting to container is always correct for a hosted panel. An opt-out invites a broken default.

## Public Methods

```typescript
sendInput(text: string): void
```

Sends text to the terminal as if the user typed it — transmits through the WebSocket to the server. This is the integration point for external features like compose overlays, paste-from-clipboard, or mobile key bar input. Equivalent to xterm.js `terminal.paste(text)` in the existing `terminal.js`.

No-op if the WebSocket is not connected.

## Events

All outward communication uses `pages-event` custom events (`bubbles: true`, `composed: true`), following the workbench primitives spec's inter-panel communication pattern. Each event carries a discriminated `detail.topic` field:

| Topic | Payload | When |
|-------|---------|------|
| `terminal-ready` | `{ cols, rows }` | After first fit with positive dimensions, before WebSocket connect |
| `terminal-resize` | `{ cols, rows }` | On container resize after fit |
| `terminal-connected` | `{}` | WebSocket opened |
| `terminal-disconnected` | `{ reason }` | WebSocket closed or session expired |

Dispatch pattern:
```typescript
this.dispatchEvent(new CustomEvent("pages-event", {
  bubbles: true,
  composed: true,
  detail: { topic: "terminal-resize", payload: { cols, rows } },
}));
```

Consumer listening pattern (from workbench primitives spec §Event Bus):
```typescript
document.addEventListener("pages-event", (e: CustomEvent) => {
  const { topic, payload } = e.detail;
  if (topic === "terminal-resize") {
    const { cols, rows } = payload;
    fetch(`/api/sessions/${sessionId}/resize?cols=${cols}&rows=${rows}`, { method: "POST" });
  }
});
```

## Server Protocol

The claudony WebSocket server (`TerminalWebSocket.java`) is a text-only protocol:
- Input: `@OnTextMessage` — receives text, sends to tmux via `send-keys -l`
- Output: `connection.sendTextAndAwait(String)` — sends terminal output as text
- History: `capture-pane` output sent as text on connection open
- Unknown session: `connection.closeAndAwait()` — close code 1000

All text messages are terminal output — the component writes them directly to the terminal display via `terminal.write(data)`. No message discrimination, no JSON parsing on the data path.

### Session expiry: close code 4001

Session expiry is signaled out-of-band via WebSocket close code **4001**, not via in-band text messages. The current server sends `{"type":"session-expired"}` as a text message — this is a protocol bug because in-band JSON control messages are indistinguishable from terminal program output (e.g., `echo '{"type":"session-expired"}'` would be swallowed).

**Required server change** (casehubio/claudony#166): replace `conn.sendTextAndAwait("{\"type\":\"session-expired\"}")` with `conn.closeAndAwait(new CloseReason(4001, "session-expired"))` in `TerminalWebSocket.onSessionExpired()`. `CloseReason` is `io.quarkus.websockets.next.CloseReason` — already in the project's dependencies (quarkus-websockets-next 3.32.2). Code 4001 is valid per RFC 6455 §7.4.2 (4000-4999 reserved for application use). This is a one-line change.

The component handles close code 4001 as a permanent termination — dispatches `terminal-disconnected` with `reason: "session-expired"` and does NOT schedule reconnection. All other close codes trigger reconnection with exponential backoff.

No binary framing — the server has no `@OnBinaryMessage` handler and uses `sendTextAndAwait(String)` exclusively. The component does not set `ws.binaryType` and does not wire `terminal.onBinary`.

## Component Lifecycle

```
configure(props)
  │
  ▼
connectedCallback()                     ← element inserted into DOM
  ├─ Create container <div> in light DOM
  ├─ new Terminal({ fontSize, fontFamily, scrollback, cursorBlink, theme })
  ├─ terminal.open(container)
  ├─ fitAddon = new FitAddon()
  ├─ terminal.loadAddon(fitAddon)
  ├─ fitAddon.fit()                     ← determines cols/rows from container
  ├─ ResizeObserver on container        ← refits on container size change
  └─ If cols > 0 && rows > 0:
       ├─ dispatch pages-event "terminal-ready" { cols, rows }
       └─ connect()
     Else:
       └─ defer — ResizeObserver will dispatch terminal-ready and connect() when dimensions become positive
  
connect()
  ├─ Replace {cols}/{rows} in wsUrl template with current dimensions
  ├─ new WebSocket(resolvedUrl)
  ├─ ws.onopen → dispatch pages-event "terminal-connected", reset retry counter
  ├─ ws.onmessage → terminal.write(data)
  ├─ terminal.onData → ws.send(data)
  ├─ ws.onclose(event) →
  │   ├─ If !this.isConnected || _tearingDown → return (element removed or reconfiguring)
  │   ├─ If event.code === 4001 → dispatch "terminal-disconnected" { reason: "session-expired" }, stop
  │   └─ Else → dispatch "terminal-disconnected" { reason: "connection-lost" }
  │            schedule reconnect (exponential backoff, max 30s)
  └─ ws.onerror → (handled by onclose)

reconnect (backoff timer fires)
  ├─ fitAddon.fit()                     ← re-evaluate dimensions (container may have collapsed)
  ├─ If cols === 0 || rows === 0:
  │   └─ skip — let ResizeObserver trigger connect() when dimensions become positive
  ├─ terminal.reset()                   ← clear buffer; server replays history on new connection
  └─ connect()

resize (ResizeObserver fires)
  ├─ If _tearingDown, return            ← guard against teardown race
  ├─ fitAddon.fit()                     ← resizes terminal grid
  ├─ If cols > 0 && rows > 0 && ws is null:
  │   ├─ dispatch pages-event "terminal-ready" { cols, rows }  ← deferred from connectedCallback
  │   └─ connect()                      ← deferred initial connection (container gained size)
  └─ If cols > 0 && rows > 0:
      └─ terminal.onResize fires
          └─ dispatch pages-event "terminal-resize" { cols, rows }

disconnectedCallback()                  ← element removed from DOM
  ├─ Cancel reconnect timer
  ├─ Close WebSocket (code 1000)        ← onclose will see !this.isConnected and skip reconnect
  ├─ Disconnect ResizeObserver
  └─ terminal.dispose()

configure(props) [reconfiguration — element already connected]
  ├─ Set _tearingDown = true            ← guard flag (onclose and resize check this)
  ├─ Cancel reconnect timer
  ├─ Close WebSocket (code 1000)
  ├─ Disconnect ResizeObserver
  ├─ terminal.dispose()
  ├─ Clear container innerHTML
  ├─ Set _tearingDown = false
  └─ Re-initialize (same as connectedCallback flow)
```

No shadow DOM — xterm.js manages its own rendering and CSS (see "Why no Shadow DOM" above).

No `AttachAddon` dependency — the bidirectional piping is 2 lines of code (onmessage → terminal.write, onData → ws.send). Not worth an npm dependency.

## CSS Loading

xterm.js requires its CSS stylesheet (`@xterm/xterm/css/xterm.css`) to render correctly. The component does not inject CSS at runtime — CSS injection as a side effect of `connectedCallback()` would risk duplicate injection, conflict with CSP policies, and create an implicit contract.

The component package re-exports the CSS file at `@casehubio/pages-component-terminal/xterm.css`. The host app imports it in its entry point:

```typescript
import "@casehubio/pages-component-terminal/xterm.css";
import "@casehubio/pages-component-terminal";
```

esbuild (per quinoa convention) and webpack both handle CSS imports natively. This follows the standard npm convention for packages with CSS dependencies (same pattern as react-datepicker, codemirror, etc.).

## Package Structure

```
components/pages-component-terminal/
  ├─ package.json          # @casehubio/pages-component-terminal
  ├─ tsconfig.json
  ├─ xterm.css             # Re-export of @xterm/xterm/css/xterm.css
  ├─ src/
  │   ├─ PagesTerminal.ts  # Custom element + customElements.define()
  │   └─ index.ts          # Re-export
  └─ tests/
      └─ PagesTerminal.test.ts
```

**Dependencies:** `@xterm/xterm`, `@xterm/addon-fit`. No other casehub packages.

**package.json exports map** (required for sub-path CSS import):
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./xterm.css": "./xterm.css"
  }
}
```

**Build:** Plain `tsc` — no webpack. Unlike iframe components (which need webpack + HtmlWebpackPlugin for standalone HTML), this is a TypeScript library that compiles to JS. The custom element self-registers on import.

Built by the existing `build:components` script (`yarn workspaces foreach -Apt --include '@casehubio/pages-component-*' run build`).

## Consumer Usage

**With pages framework (claudony migration path):**
```typescript
import "@casehubio/pages-component-terminal/xterm.css";
import "@casehubio/pages-component-terminal";
import { loadSite, registerPanel } from "@casehubio/pages-runtime";
import { hostPanel, split } from "@casehubio/pages-ui";

registerPanel("terminal", "pages-component-terminal");

const app = split("horizontal", [
  hostPanel("session-grid"),
  hostPanel("terminal", {
    wsUrl: `ws://localhost:8080/ws/${sessionId}/{cols}/{rows}`,
    fontSize: 14,
    theme: { background: "#1e1e1e", foreground: "#d4d4d4" },
  }),
]);
loadSite(container, app);

document.addEventListener("pages-event", (e: CustomEvent) => {
  const { topic, payload } = e.detail;
  if (topic === "terminal-resize") {
    const { cols, rows } = payload;
    fetch(`/api/sessions/${sessionId}/resize?cols=${cols}&rows=${rows}`, { method: "POST" });
  }
});
```

**Standalone (no pages framework):**
```typescript
import "@casehubio/pages-component-terminal/xterm.css";
import "@casehubio/pages-component-terminal";

const el = document.createElement("pages-component-terminal");
el.configure({ wsUrl: "ws://localhost:8080/ws/session-1/{cols}/{rows}" });
document.body.appendChild(el);
```

**External text input (compose overlay integration):**
```typescript
const terminal = document.querySelector("pages-component-terminal");
terminal.sendInput(composedText);
```

## Testing Strategy

xterm.js testing requires specific considerations beyond standard component testing:

**Unit tests (jsdom):**
- Mock `WebSocket` for connection lifecycle (open, close with various codes, reconnect, deferred connect)
- Mock `ResizeObserver` (not available in jsdom) — verify fit and resize event dispatch
- Custom element registration works in jsdom (v20+) — test `connectedCallback`, `disconnectedCallback`, `configure()` lifecycle
- Verify `_tearingDown` guard prevents race conditions during reconfiguration
- Verify `terminal.reset()` is called before reconnection

**Integration tests (Playwright):**
- Real browser with actual pixel measurements — verify `FitAddon.fit()` calculates correct cols/rows
- Real WebSocket against a test server — verify end-to-end bidirectional communication
- Verify xterm.css loaded correctly — terminal renders with expected dimensions

**What to mock, what to test real:**
- Mock: `WebSocket`, `ResizeObserver`, `FitAddon.fit()` return values (for unit tests)
- Real: DOM measurement, CSS loading, custom element lifecycle (for integration tests)
- Spy: `terminal.write()`, `terminal.reset()`, `terminal.dispose()` to verify call sequences

## Not in Scope

- Application-specific overlays (compose editors, mobile key bars) — host app renders these as siblings outside the pages layout tree (per quinoa adoption design), using `sendInput()` for terminal interaction
- Session management — host app provides the wsUrl
- CSS custom property theming — pages has no CSS custom property system; theme is passed explicitly via props. When/if pages establishes a CSS custom property convention, the terminal can adopt it. (Note: issue #80 listed this as a responsibility — the issue needs updating to reflect that props-based theming is the correct approach given the current platform state.)
