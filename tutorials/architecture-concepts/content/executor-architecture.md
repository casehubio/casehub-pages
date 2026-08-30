# Distributed Executor Architecture

The scenario engine uses a **star topology** — a central orchestrator dispatches commands to independent executors via the push wire protocol.

<svg viewBox="0 0 460 240" xmlns="http://www.w3.org/2000/svg" style="width: 100%; max-width: 460px;">
  <rect x="170" y="20" width="120" height="50" rx="8" fill="var(--pages-accent-3, #e8eaf6)" stroke="var(--pages-accent-7, #6366f1)" stroke-width="2"/>
  <text x="230" y="50" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="13" font-family="system-ui">Orchestrator</text>

  <rect x="20" y="150" width="120" height="50" rx="8" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-7, #a3a3a3)" stroke-width="1.5"/>
  <text x="80" y="180" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="12" font-family="system-ui">Browser Executor</text>

  <rect x="170" y="150" width="120" height="50" rx="8" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-7, #a3a3a3)" stroke-width="1.5"/>
  <text x="230" y="175" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="11" font-family="system-ui">Service Executor</text>
  <text x="230" y="190" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="10" font-family="system-ui">(helpdesk)</text>

  <rect x="320" y="150" width="120" height="50" rx="8" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-7, #a3a3a3)" stroke-width="1.5"/>
  <text x="380" y="175" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="11" font-family="system-ui">Service Executor</text>
  <text x="380" y="190" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="10" font-family="system-ui">(connectors)</text>

  <line x1="200" y1="70" x2="80" y2="150" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5" stroke-dasharray="6 3"/>
  <line x1="230" y1="70" x2="230" y2="150" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5" stroke-dasharray="6 3"/>
  <line x1="260" y1="70" x2="380" y2="150" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5" stroke-dasharray="6 3"/>

  <text x="100" y="120" fill="var(--pages-neutral-8, #999)" font-size="10" font-family="system-ui">push wire</text>
  <text x="310" y="120" fill="var(--pages-neutral-8, #999)" font-size="10" font-family="system-ui">push wire</text>
</svg>

**Orchestrator** — the central coordinator. It reads the scenario YAML, builds an execution plan, and dispatches command sequences to executors. In server mode, this is the Pages Java backend. In browser-only mode, the TypeScript runtime acts as orchestrator.

**Browser Executor** — handles ARIA commands (`click`, `fill`, `select`, `assert`, `wait`). It finds UI elements by their accessibility role and name, then performs the interaction. Visual feedback highlights each element as it's automated.

**Service Executors** — backend services that embed a shared executor library. They handle domain-specific operations (create a helpdesk ticket, inject a chat message) via `@ScenarioAction` annotated handlers.

Commands flow **down** from orchestrator to executors. Results flow **up** — each executor reports step completion, errors, and state changes back to the orchestrator.
