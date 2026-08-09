# Terminal Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@casehubio/pages-component-terminal` — a Web Component wrapping xterm.js with managed WebSocket lifecycle, mounted via `hostPanel()`.

**Architecture:** A custom element (`pages-component-terminal`) that creates an xterm.js Terminal in light DOM, owns the WebSocket connection (with URL template placeholder substitution for `{cols}`/`{rows}`), handles reconnection with exponential backoff, and communicates via `pages-event` CustomEvents. No shadow DOM. No iframe. No AttachAddon.

**Tech Stack:** TypeScript 5, xterm.js 6 (`@xterm/xterm`), `@xterm/addon-fit`, Vitest

**Spec:** `docs/superpowers/specs/2026-06-30-terminal-component-design.md`

## Global Constraints

- Package name: `@casehubio/pages-component-terminal`
- Version: `0.2.0` (matches other components)
- Custom element tag: `pages-component-terminal`
- All events use `pages-event` with discriminated `detail.topic` and `detail.payload`
- Text-only WebSocket — no binary, no `ws.binaryType`, no `terminal.onBinary`
- Close code 4001 = session expired (permanent, no reconnect)
- CSS loaded by consumer via explicit import, not injected at runtime
- tsconfig extends `@casehubio/pages-tsconfig`
- Test framework: Vitest (consistent with pages-data, pages-runtime)
- ESLint with `@typescript-eslint/strict-type-checked`
- No dependencies on any `@casehubio/pages-*` package

---

### Task 1: Package scaffold and build integration

**Files:**
- Create: `components/pages-component-terminal/package.json`
- Create: `components/pages-component-terminal/tsconfig.json`
- Create: `components/pages-component-terminal/tsconfig.build.json`
- Create: `components/pages-component-terminal/xterm.css`
- Create: `components/pages-component-terminal/src/index.ts`
- Create: `components/pages-component-terminal/src/PagesTerminal.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `PagesTerminal` class (custom element), `TerminalProps` type, `configure()` method, `sendInput()` method — all exported from `src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@casehubio/pages-component-terminal",
  "version": "0.2.0",
  "description": "CaseHub Pages terminal component — xterm.js Web Component",
  "license": "Apache-2.0",
  "homepage": "https://github.com/casehubio/casehub-pages",
  "repository": {
    "type": "git",
    "url": "https://github.com/casehubio/casehub-pages.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "bugs": {
    "url": "https://github.com/casehubio/casehub-pages/issues"
  },
  "type": "module",
  "types": "./dist/index.d.ts",
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./xterm.css": "./xterm.css"
  },
  "files": [
    "dist",
    "xterm.css"
  ],
  "scripts": {
    "build": "vitest run && tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "@xterm/xterm": "^6.0.0",
    "@xterm/addon-fit": "^0.11.0"
  },
  "devDependencies": {
    "@casehubio/pages-tsconfig": "workspace:*",
    "rimraf": "^6.1.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json (type-checking)**

```json
{
  "extends": "@casehubio/pages-tsconfig/tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": ".typecheck",
    "emitDeclarationOnly": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create tsconfig.build.json (build output)**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "emitDeclarationOnly": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create xterm.css re-export**

Create `components/pages-component-terminal/xterm.css`:
```css
@import "@xterm/xterm/css/xterm.css";
```

- [ ] **Step 5: Create stub PagesTerminal.ts**

Create `components/pages-component-terminal/src/PagesTerminal.ts`:
```typescript
export interface TerminalProps {
  wsUrl: string;
  fontSize?: number;
  fontFamily?: string;
  scrollback?: number;
  cursorBlink?: boolean;
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

export class PagesTerminal extends HTMLElement {
  private _props: TerminalProps | undefined;

  configure(props: TerminalProps): void {
    this._props = props;
  }

  sendInput(_text: string): void {
    // implemented in Task 3
  }
}

customElements.define("pages-component-terminal", PagesTerminal);
```

- [ ] **Step 6: Create index.ts**

Create `components/pages-component-terminal/src/index.ts`:
```typescript
export { PagesTerminal } from "./PagesTerminal.js";
export type { TerminalProps } from "./PagesTerminal.js";
```

- [ ] **Step 7: Install dependencies and verify build**

Run: `yarn install && yarn workspace @casehubio/pages-component-terminal run build`
Expected: compiles cleanly, `dist/` contains `index.js`, `index.d.ts`, `PagesTerminal.js`, `PagesTerminal.d.ts`

- [ ] **Step 8: Commit**

```
git add components/pages-component-terminal/
git commit -m "feat: scaffold pages-component-terminal package Refs #80"
```

---

### Task 2: Terminal lifecycle — mount, fit, teardown

**Files:**
- Modify: `components/pages-component-terminal/src/PagesTerminal.ts`
- Create: `components/pages-component-terminal/src/PagesTerminal.test.ts`

**Interfaces:**
- Consumes: `TerminalProps` from Task 1
- Produces: `connectedCallback()`, `disconnectedCallback()`, `configure()` with teardown/re-init, `_tearingDown` guard, `pages-event` dispatch for `terminal-ready` and `terminal-resize`

- [ ] **Step 1: Write failing tests for terminal lifecycle**

Create `components/pages-component-terminal/src/PagesTerminal.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock xterm.js before importing PagesTerminal
const mockTerminal = {
  open: vi.fn(),
  dispose: vi.fn(),
  reset: vi.fn(),
  write: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  onResize: vi.fn(() => ({ dispose: vi.fn() })),
  rows: 24,
  cols: 80,
};
vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn(() => mockTerminal),
}));

const mockFitAddon = {
  fit: vi.fn(),
  activate: vi.fn(),
  dispose: vi.fn(),
};
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn(() => mockFitAddon),
}));

// Mock ResizeObserver
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observing: Element[] = [];
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe(target: Element): void {
    this.observing.push(target);
  }
  unobserve(): void { /* no-op */ }
  disconnect(): void {
    this.observing = [];
  }
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  send(data: string): void { this.sent.push(data); }
  close(_code?: number): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: _code ?? 1000, reason: "" });
  }
  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}
vi.stubGlobal("WebSocket", MockWebSocket);

import "./PagesTerminal.js";

describe("PagesTerminal", () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    MockResizeObserver.instances = [];
    mockTerminal.rows = 24;
    mockTerminal.cols = 80;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function createElement(props?: Record<string, unknown>): HTMLElement {
    const el = document.createElement("pages-component-terminal") as HTMLElement & {
      configure: (p: Record<string, unknown>) => void;
    };
    if (props) el.configure(props);
    return el;
  }

  describe("mount lifecycle", () => {
    it("creates terminal and fits on connectedCallback", () => {
      const el = createElement({ wsUrl: "ws://localhost/ws/{cols}/{rows}" });
      container.appendChild(el);

      expect(mockTerminal.open).toHaveBeenCalledOnce();
      expect(mockFitAddon.fit).toHaveBeenCalledOnce();
    });

    it("dispatches terminal-ready with dimensions after fit", () => {
      const events: CustomEvent[] = [];
      container.addEventListener("pages-event", ((e: CustomEvent) => {
        events.push(e);
      }) as EventListener);

      const el = createElement({ wsUrl: "ws://localhost/ws/{cols}/{rows}" });
      container.appendChild(el);

      const ready = events.find(e => e.detail.topic === "terminal-ready");
      expect(ready).toBeDefined();
      expect(ready!.detail.payload).toEqual({ cols: 80, rows: 24 });
    });

    it("defers connect when dimensions are zero", () => {
      mockTerminal.cols = 0;
      mockTerminal.rows = 0;

      const el = createElement({ wsUrl: "ws://localhost/ws/{cols}/{rows}" });
      container.appendChild(el);

      expect(MockWebSocket.instances).toHaveLength(0);
    });

    it("disposes terminal on disconnectedCallback", () => {
      const el = createElement({ wsUrl: "ws://localhost/ws/{cols}/{rows}" });
      container.appendChild(el);
      el.remove();

      expect(mockTerminal.dispose).toHaveBeenCalledOnce();
    });

    it("tears down and re-inits on reconfigure", () => {
      const el = createElement({ wsUrl: "ws://localhost/ws/{cols}/{rows}" });
      container.appendChild(el);

      const typedEl = el as unknown as { configure: (p: Record<string, unknown>) => void };
      typedEl.configure({ wsUrl: "ws://other/ws/{cols}/{rows}" });

      // dispose called for teardown, then open called again for re-init
      expect(mockTerminal.dispose).toHaveBeenCalledOnce();
      expect(mockTerminal.open).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/pages-component-terminal run test`
Expected: FAIL — PagesTerminal stub doesn't create Terminal or call fit

- [ ] **Step 3: Implement terminal lifecycle in PagesTerminal.ts**

Replace the PagesTerminal class body in `components/pages-component-terminal/src/PagesTerminal.ts`:

```typescript
import { Terminal } from "@xterm/xterm";
import type { ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export interface TerminalProps {
  wsUrl: string;
  fontSize?: number;
  fontFamily?: string;
  scrollback?: number;
  cursorBlink?: boolean;
  theme?: Partial<ITheme>;
}

export class PagesTerminal extends HTMLElement {
  private _props: TerminalProps | undefined;
  private _terminal: Terminal | undefined;
  private _fitAddon: FitAddon | undefined;
  private _ws: WebSocket | undefined;
  private _resizeObserver: ResizeObserver | undefined;
  private _reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private _retries = 0;
  private _tearingDown = false;
  private _onDataDisposable: { dispose(): void } | undefined;
  private _onResizeDisposable: { dispose(): void } | undefined;
  private _connected = false;

  configure(props: TerminalProps): void {
    this._props = props;
    if (this._connected) {
      this._teardown();
      this._init();
    }
  }

  connectedCallback(): void {
    this._connected = true;
    if (this._props) {
      this._init();
    }
  }

  disconnectedCallback(): void {
    this._connected = false;
    this._teardown();
  }

  sendInput(text: string): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(text);
    }
  }

  private _init(): void {
    const props = this._props;
    if (!props) return;

    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";
    this.appendChild(container);

    const terminal = new Terminal({
      fontSize: props.fontSize ?? 14,
      fontFamily: props.fontFamily ?? "Menlo, Monaco, Consolas, monospace",
      scrollback: props.scrollback ?? 5000,
      cursorBlink: props.cursorBlink ?? true,
      theme: props.theme,
    });
    this._terminal = terminal;

    terminal.open(container);

    const fitAddon = new FitAddon();
    this._fitAddon = fitAddon;
    terminal.loadAddon(fitAddon);
    fitAddon.fit();

    this._onResizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (this._tearingDown) return;
      this._dispatchEvent("terminal-resize", { cols, rows });
    });

    this._resizeObserver = new ResizeObserver(() => {
      if (this._tearingDown) return;
      fitAddon.fit();
      if (terminal.cols > 0 && terminal.rows > 0 && !this._ws) {
        this._dispatchEvent("terminal-ready", { cols: terminal.cols, rows: terminal.rows });
        this._connect();
      }
    });
    this._resizeObserver.observe(container);

    if (terminal.cols > 0 && terminal.rows > 0) {
      this._dispatchEvent("terminal-ready", { cols: terminal.cols, rows: terminal.rows });
      this._connect();
    }
  }

  private _connect(): void {
    const props = this._props;
    const terminal = this._terminal;
    if (!props || !terminal) return;

    const url = props.wsUrl
      .replace("{cols}", String(terminal.cols))
      .replace("{rows}", String(terminal.rows));

    const ws = new WebSocket(url);
    this._ws = ws;

    ws.onopen = () => {
      this._retries = 0;
      this._dispatchEvent("terminal-connected", {});
    };

    ws.onmessage = (event: MessageEvent) => {
      terminal.write(event.data as string);
    };

    this._onDataDisposable = terminal.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ws.onclose = (event: CloseEvent) => {
      this._ws = undefined;
      this._onDataDisposable?.dispose();
      this._onDataDisposable = undefined;

      if (!this._connected || this._tearingDown) return;

      if (event.code === 4001) {
        this._dispatchEvent("terminal-disconnected", { reason: "session-expired" });
        return;
      }

      this._dispatchEvent("terminal-disconnected", { reason: "connection-lost" });
      this._scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private _scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this._retries), 30000);
    this._retries++;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = undefined;
      if (!this._connected || this._tearingDown) return;

      this._fitAddon?.fit();
      const terminal = this._terminal;
      if (!terminal || terminal.cols === 0 || terminal.rows === 0) return;

      terminal.reset();
      this._connect();
    }, delay);
  }

  private _teardown(): void {
    this._tearingDown = true;

    if (this._reconnectTimer !== undefined) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }

    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close(1000);
      this._ws = undefined;
    }

    this._onDataDisposable?.dispose();
    this._onDataDisposable = undefined;
    this._onResizeDisposable?.dispose();
    this._onResizeDisposable = undefined;
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    this._terminal?.dispose();
    this._terminal = undefined;
    this._fitAddon = undefined;
    this._retries = 0;
    this.innerHTML = "";

    this._tearingDown = false;
  }

  private _dispatchEvent(topic: string, payload: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent("pages-event", {
      bubbles: true,
      composed: true,
      detail: { topic, payload },
    }));
  }
}

customElements.define("pages-component-terminal", PagesTerminal);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-component-terminal run test`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```
git add components/pages-component-terminal/src/
git commit -m "feat: terminal lifecycle — mount, fit, teardown, pages-event dispatch Refs #80"
```

---

### Task 3: WebSocket lifecycle — connect, reconnect, session expiry

**Files:**
- Modify: `components/pages-component-terminal/src/PagesTerminal.test.ts`

**Interfaces:**
- Consumes: `PagesTerminal` from Task 2 (already implemented)
- Produces: test coverage for WebSocket connect, URL template substitution, reconnect backoff, close code 4001, sendInput, tearingDown guard

- [ ] **Step 1: Add WebSocket lifecycle tests**

Append to the `describe("PagesTerminal")` block in `PagesTerminal.test.ts`:

```typescript
  describe("WebSocket lifecycle", () => {
    it("connects WebSocket with template-substituted URL", () => {
      const el = createElement({ wsUrl: "ws://host/ws/session-1/{cols}/{rows}" });
      container.appendChild(el);

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0]!.url).toBe("ws://host/ws/session-1/80/24");
    });

    it("dispatches terminal-connected on ws open", () => {
      const events: CustomEvent[] = [];
      container.addEventListener("pages-event", ((e: CustomEvent) => {
        events.push(e);
      }) as EventListener);

      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);
      MockWebSocket.instances[0]!.open();

      const connected = events.find(e => e.detail.topic === "terminal-connected");
      expect(connected).toBeDefined();
    });

    it("writes received text to terminal", () => {
      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);
      const ws = MockWebSocket.instances[0]!;
      ws.open();

      ws.onmessage?.({ data: "hello world" } as MessageEvent);

      expect(mockTerminal.write).toHaveBeenCalledWith("hello world");
    });

    it("sends terminal input through WebSocket", () => {
      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);
      const ws = MockWebSocket.instances[0]!;
      ws.open();

      // Simulate terminal.onData callback
      const onDataCallback = mockTerminal.onData.mock.calls[0]![0] as (data: string) => void;
      onDataCallback("ls\r");

      expect(ws.sent).toContain("ls\r");
    });

    it("dispatches terminal-disconnected with session-expired on code 4001", () => {
      const events: CustomEvent[] = [];
      container.addEventListener("pages-event", ((e: CustomEvent) => {
        events.push(e);
      }) as EventListener);

      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);
      const ws = MockWebSocket.instances[0]!;
      ws.open();
      ws.onclose?.({ code: 4001, reason: "session-expired" } as CloseEvent);

      const disconnected = events.find(e => e.detail.topic === "terminal-disconnected");
      expect(disconnected).toBeDefined();
      expect(disconnected!.detail.payload.reason).toBe("session-expired");
    });

    it("does not reconnect on code 4001", async () => {
      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);
      const ws = MockWebSocket.instances[0]!;
      ws.open();
      ws.onclose?.({ code: 4001, reason: "session-expired" } as CloseEvent);

      await new Promise(r => setTimeout(r, 1500));
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    it("reconnects with backoff on normal close", async () => {
      vi.useFakeTimers();
      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);
      const ws = MockWebSocket.instances[0]!;
      ws.open();
      ws.onclose?.({ code: 1006, reason: "" } as CloseEvent);

      expect(MockWebSocket.instances).toHaveLength(1);

      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(mockTerminal.reset).toHaveBeenCalledOnce();

      vi.useRealTimers();
    });

    it("does not reconnect after element removal", () => {
      vi.useFakeTimers();
      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);
      const ws = MockWebSocket.instances[0]!;
      ws.open();

      el.remove();

      // ws.onclose won't fire because _teardown nulled it
      // but even if it did, _connected is false
      vi.advanceTimersByTime(5000);
      expect(MockWebSocket.instances).toHaveLength(1);

      vi.useRealTimers();
    });

    it("sendInput sends text through connected WebSocket", () => {
      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);
      const ws = MockWebSocket.instances[0]!;
      ws.open();

      (el as unknown as { sendInput: (t: string) => void }).sendInput("composed text");
      expect(ws.sent).toContain("composed text");
    });

    it("sendInput is no-op when WebSocket is not connected", () => {
      const el = createElement({ wsUrl: "ws://host/ws/{cols}/{rows}" });
      container.appendChild(el);

      // ws exists but is still CONNECTING (not open)
      (el as unknown as { sendInput: (t: string) => void }).sendInput("text");
      expect(MockWebSocket.instances[0]!.sent).toHaveLength(0);
    });

    it("uses plain URL when no placeholders present", () => {
      const el = createElement({ wsUrl: "ws://host/ws/fixed-session" });
      container.appendChild(el);

      expect(MockWebSocket.instances[0]!.url).toBe("ws://host/ws/fixed-session");
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `yarn workspace @casehubio/pages-component-terminal run test`
Expected: all tests PASS (implementation already done in Task 2)

- [ ] **Step 3: Commit**

```
git add components/pages-component-terminal/src/PagesTerminal.test.ts
git commit -m "test: WebSocket lifecycle — connect, reconnect, session expiry, sendInput Refs #80"
```

---

### Task 4: Build integration, typecheck, and final verification

**Files:**
- Modify: `components/pages-component-terminal/package.json` (if adjustments needed)

**Interfaces:**
- Consumes: everything from Tasks 1-3
- Produces: clean build, clean typecheck, clean lint, passing tests

- [ ] **Step 1: Run full build**

Run: `yarn workspace @casehubio/pages-component-terminal run build`
Expected: tests pass, `dist/` contains compiled JS and `.d.ts` files

- [ ] **Step 2: Verify type declarations**

Run: `yarn workspace @casehubio/pages-component-terminal run typecheck`
Expected: no errors

- [ ] **Step 3: Verify exports map works**

Run: `ls components/pages-component-terminal/dist/index.js components/pages-component-terminal/dist/index.d.ts components/pages-component-terminal/xterm.css`
Expected: all three files exist

- [ ] **Step 4: Verify monorepo build integration**

Run: `yarn build:components`
Expected: all components build successfully including the new terminal component

- [ ] **Step 5: Run project-wide typecheck**

Run: `yarn typecheck`
Expected: no errors

- [ ] **Step 6: Commit if any adjustments were needed**

```
git add -A
git commit -m "chore: build integration and final verification Refs #80"
```
