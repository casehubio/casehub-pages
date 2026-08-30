# The Controller UI

The scenario controller is the panel you've been using to step through this tutorial. It provides:

**Outline tree** — shows the scenario structure with sections and steps. The current position is highlighted. Click any section or step to jump to it.

**Transport controls:**
- **Play/Pause** (▶/⏸) — run continuously or pause
- **Step** (⏩) — advance one step at a time
- **Speed slider** — control execution speed (slower for demos, faster for automation)

**Compact mode** — in real applications, the controller appears as a floating pill in the corner. Click it to expand the full outline and controls. Drag it to reposition.

**YAML viewer** — the `{ }` toggle opens a fly-out showing the scenario source with syntax highlighting and live position tracking. As each step executes, the viewer scrolls to and highlights the corresponding YAML.

All of these work identically in server mode (real backend) and browser-only mode (tutorials and demos).
