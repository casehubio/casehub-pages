# Getting Started with casehub-pages

Build a web application frontend using casehub-pages — layouts, data pipelines, and hosted components. This guide uses a chat client as a running example, but the patterns apply to any application.

## 1. Add casehub-pages to your project

casehub-pages is a set of `@casehubio/*` npm packages. For local development, reference them via `file:` paths in your `package.json`:

```json
{
  "dependencies": {
    "@casehubio/pages-runtime": "file:../../casehub/pages/packages/pages-runtime",
    "@casehubio/pages-ui": "file:../../casehub/pages/packages/pages-ui",
    "@casehubio/pages-component": "file:../../casehub/pages/packages/pages-component",
    "@casehubio/pages-data": "file:../../casehub/pages/packages/pages-data",
    "@casehubio/pages-viz": "file:../../casehub/pages/packages/pages-viz"
  }
}
```

Adjust the relative paths to match your repo layout. Then `yarn install`.

**Prerequisite:** the pages packages must be built first:

```bash
cd /path/to/casehub/pages
yarn install && yarn build
```

### Quarkus + Quinoa setup

If your backend is Quarkus, use Quinoa to serve the frontend:

```xml
<!-- pom.xml -->
<dependency>
  <groupId>io.quarkiverse.quinoa</groupId>
  <artifactId>quarkus-quinoa</artifactId>
  <version>2.5.3</version>
</dependency>
```

```properties
# application.properties
quarkus.quinoa.package-manager-install=true
quarkus.quinoa.package-manager-install.node-version=22.16.0
quarkus.quinoa.build-dir=dist
quarkus.quinoa.enable-spa-routing=true
```

Place your frontend code in `src/main/webui/`. Quinoa will install dependencies, build the frontend, and serve it alongside the Quarkus API.

## 2. Hello World — loadSite

The entry point is `loadSite()`. It takes a target DOM element and a component tree, and renders the application.

```typescript
// src/main/webui/src/index.ts
import { loadSite } from "@casehubio/pages-runtime";
import { rows, panel, html } from "@casehubio/pages-ui";

const app = rows(
  panel("My App",
    html("<h1>Hello, casehub-pages!</h1>"),
  ),
);

const site = await loadSite(document.getElementById("app")!, app);
```

```html
<!-- src/main/webui/src/index.html -->
<!DOCTYPE html>
<html>
<head><title>My App</title></head>
<body>
  <div id="app" style="height: 100vh;"></div>
  <script type="module" src="./index.ts"></script>
</body>
</html>
```

`loadSite` returns a `LiveSite` handle with `navigate()`, `setTheme()`, `dispose()`, and a `layout` getter.

## 3. Layouts — splits, rows, columns

casehub-pages provides recursive layout primitives. Any component can nest inside any other.

```typescript
import { rows, columns, split, panel, html } from "@casehubio/pages-ui";

// Fixed layout (no resize)
const fixed = columns([1, 3],
  [html("<nav>Sidebar</nav>")],
  [html("<main>Content</main>")],
);

// Resizable layout (drag handles between children)
const resizable = split("horizontal", [
  html("<nav>Sidebar</nav>"),
  html("<main>Content</main>"),
], { ratio: [25, 75] });

// Nested layout
const workspace = rows(
  html("<header>Topbar</header>"),
  split("horizontal", [
    html("<nav>Channels</nav>"),
    split("vertical", [
      html("<div>Messages</div>"),
      html("<div>Thread</div>"),
    ], { ratio: [70, 30] }),
  ], { ratio: [20, 80] }),
  html("<footer>Status</footer>"),
);
```

Use `split` when children should be user-resizable or dock-togglable. Use `columns`/`rows` for fixed layouts.

## 4. Hosted panels — registerPanel + hostPanel

For complex UI regions (message list, channel sidebar, user profile), build Web Components and host them in the layout.

### Define a Web Component

```typescript
// src/main/webui/src/panels/message-list.ts
export class MessageList extends HTMLElement {
  private _props: Record<string, unknown> = {};

  configure(props: Record<string, unknown>): void {
    this._props = props;
    if (this.isConnected) this._render();
  }

  connectedCallback(): void {
    this._render();
  }

  private _render(): void {
    const channelId = this._props.channelId as string ?? "";
    this.innerHTML = `<div class="messages">Messages for ${channelId}</div>`;
  }
}

customElements.define("app-message-list", MessageList);
```

**Key contract:** panels implement `configure(props)` — called before `connectedCallback()`. Props come from the component tree definition.

### Register and host

```typescript
import { registerPanel, loadSite } from "@casehubio/pages-runtime";
import { split, hostPanel, withId } from "@casehubio/pages-ui";

// Import so customElements.define() runs
import "./panels/message-list.js";
import "./panels/channel-sidebar.js";

// Register panel types (before loadSite)
registerPanel("message-list", "app-message-list");
registerPanel("channel-sidebar", "app-channel-sidebar");

const app = split("horizontal", [
  hostPanel("channel-sidebar"),
  withId("messages", hostPanel("message-list", { channelId: "general" })),
], { ratio: [25, 75] });

const site = await loadSite(document.getElementById("app")!, app);
```

`withId()` assigns a stable ID to a component — needed for dock toggles and layout serialization.

## 5. Dock bars — toggle panel visibility

A dock bar is an icon strip that toggles visibility of referenced panels by ID.

```typescript
import { rows, columns, split, dockBar, hostPanel, withId } from "@casehubio/pages-ui";

const app = rows(
  html("<header>Chat App</header>"),
  columns([0, 1],
    [dockBar("vertical", [
      { icon: "💬", label: "Threads", panelId: "threads", defaultOpen: true },
      { icon: "👥", label: "Members", panelId: "members", defaultOpen: false },
    ])],
    [split("horizontal", [
      hostPanel("channel-sidebar"),
      hostPanel("message-list", { channelId: "general" }),
      withId("threads", hostPanel("thread-viewer")),
      withId("members", hostPanel("member-list")),
    ], { ratio: [20, 50, 20, 10] })],
  ),
);
```

Clicking a dock icon dispatches `pages-dock-toggle` — the runtime hides/shows the targeted panel and redistributes space among siblings.

## 6. Inter-panel communication — pages-event

Panels communicate via DOM events — no shared state, no global bus.

```typescript
// Panel A dispatches
this.dispatchEvent(new CustomEvent("pages-event", {
  bubbles: true,
  composed: true,
  detail: { topic: "channel-selected", payload: { channelId: "general" } },
}));

// Panel B listens (always on document, never on this.getRootNode())
document.addEventListener("pages-event", (e: Event) => {
  const { topic, payload } = (e as CustomEvent).detail;
  if (topic === "channel-selected") {
    this.loadMessages(payload.channelId);
  }
});
```

## 7. Real-time data — WebSocket and SSE sources

casehub-pages has a reactive data pipeline. Define data sources in the component tree and bind them to components.

### WebSocket source (bidirectional)

```yaml
# Or build programmatically with the TypeScript DSL
datasets:
  - id: messages
    url: ws://localhost:8080/ws/messages
    accumulate: true
```

The WebSocket uses an operation vocabulary: `snapshot` (initial state), `append` (new item), `replace` (update), `remove` (delete). Server sends:

```json
{ "op": "snapshot", "dataset": "messages", "columns": [...], "rows": [...] }
{ "op": "append", "dataset": "messages", "rows": [...] }
```

### SSE source (server push)

```yaml
datasets:
  - id: presence
    url: sse://localhost:8080/sse/presence
```

Same operation vocabulary over Server-Sent Events instead of WebSocket.

### Event operations (inter-panel via server)

```json
{ "op": "event", "topic": "typing-indicator", "payload": { "user": "alice" } }
```

`event` ops bypass the dataset pipeline and dispatch as `pages-event` DOM events — same as local inter-panel communication, but from the server.

## 8. Putting it together — chat client layout

```typescript
import { registerPanel, loadSite } from "@casehubio/pages-runtime";
import { rows, columns, split, dockBar, hostPanel, withId, html } from "@casehubio/pages-ui";

// Import panel Web Components
import "./panels/channel-sidebar.js";
import "./panels/message-list.js";
import "./panels/message-input.js";
import "./panels/thread-viewer.js";
import "./panels/member-list.js";
import "./panels/user-status.js";

// Register panels
registerPanel("channels", "chat-channel-sidebar");
registerPanel("messages", "chat-message-list");
registerPanel("input", "chat-message-input");
registerPanel("threads", "chat-thread-viewer");
registerPanel("members", "chat-member-list");
registerPanel("status", "chat-user-status");

// Build the workspace
const chatApp = rows(
  // Topbar
  columns([1, 0],
    [html("<h2 style='padding:8px 16px;margin:0'>Chat</h2>")],
    [hostPanel("status")],
  ),

  // Main workspace
  columns([0, 1],
    // Dock bar (left edge)
    [dockBar("vertical", [
      { icon: "🧵", label: "Threads", panelId: "thread-panel", defaultOpen: false },
      { icon: "👥", label: "Members", panelId: "member-panel", defaultOpen: false },
    ])],

    // Content area
    [split("horizontal", [
      // Channel sidebar
      hostPanel("channels"),

      // Message area (vertical split: messages + input)
      split("vertical", [
        hostPanel("messages", { channelId: "general" }),
        hostPanel("input", { channelId: "general" }),
      ], { ratio: [85, 15] }),

      // Toggleable side panels
      withId("thread-panel", hostPanel("threads")),
      withId("member-panel", hostPanel("members")),
    ], { ratio: [20, 60, 15, 5] })],
  ),

  // Status bar
  html("<div style='padding:4px 16px;font-size:12px;color:#888'>Connected</div>"),
);

// Render
const site = await loadSite(document.getElementById("app")!, chatApp);
```

## 9. Layout persistence (coming in 0.3.0)

Save and restore workspace arrangements — split ratios, dock states, panel configurations.

```typescript
import { createLocalLayoutStore } from "@casehubio/pages-runtime";

const site = await loadSite(document.getElementById("app")!, chatApp, {
  layoutStore: createLocalLayoutStore(),
  layoutKey: "chat-main-workspace",
});

// Layout auto-saves on split drag and dock toggle.
// On next load, the saved layout is restored automatically.

// Manual export (for sharing or server-side storage)
const snapshot = JSON.stringify(site.layout);
```

## What's next

- **Theme:** `site.setTheme("dark")` switches to dark mode
- **Navigation:** Use `tabs`, `sidebar`, `accordion` for multi-page layouts
- **Forms:** Native form components with save adapters
- **Data viz:** Charts, tables, and metrics bound to datasets
- **Terminal:** `@casehubio/pages-component-terminal` for xterm.js WebSocket terminals
