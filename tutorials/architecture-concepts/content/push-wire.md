# Push Wire Protocol

Communication between orchestrator and executors uses the **push wire** — an event-based protocol over WebSocket (server mode) or local EventTarget (browser-only mode).

**Why events, not request/response?**

Traditional REST calls are synchronous — the orchestrator sends a request and waits for a response. This blocks the orchestrator and prevents features like speed control, stepping, and pause/resume.

The push wire is **event-based**:
- The orchestrator dispatches a **sequence** of commands to an executor
- The executor processes commands at its own pace, reporting results as events
- The orchestrator can send **control messages** (pause, resume, speed change) at any time without waiting for a response

**Message types:**

- `dispatch-sequence` — orchestrator sends a batch of steps to an executor
- `command-result` — executor reports completion of a single step
- `executor-control` — orchestrator sends speed/pause/stop signals
- `scenario:state` — orchestrator broadcasts current execution state to all listeners (controllers, viewers)

**Transport independence:** The push wire protocol is transport-agnostic. In server mode, it runs over WebSocket via `EventConnection`. In browser-only mode (tutorials, demos), it runs over a shared `EventTarget` — same message format, no network.
