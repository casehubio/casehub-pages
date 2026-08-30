# What is the Scenario Engine?

The scenario engine is an **automation platform** — not just a demo tool. It orchestrates scripted workflows across browsers and backend services using a declarative YAML format.

**What it automates:**
- Interactive demos and walkthroughs
- Onboarding workflows (create accounts, assign roles, configure settings)
- Data imports (iterate CSV rows, fill forms, validate results)
- Environment setup (provision resources, configure integrations)

**How it works:**
A scenario YAML file declares **what** should happen. The engine handles **how** — targeting UI elements by their accessibility roles, dispatching commands to executors, and coordinating multi-step workflows across distributed services.

**Key principle:** Scenarios describe desired state, not implementation details. The same scenario runs in a browser demo, a headless test, or a production automation — the engine adapts the execution strategy to the environment.

This tutorial series walks through the platform's architecture, then teaches you to write scenarios hands-on.
