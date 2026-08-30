# Compilation Pipeline

A scenario YAML file goes through a **compilation pipeline** before execution. Each stage transforms or expands the input, producing a flat execution plan.

<svg viewBox="0 0 460 100" xmlns="http://www.w3.org/2000/svg" style="width: 100%; max-width: 460px;">
  <rect x="5" y="30" width="60" height="40" rx="4" fill="var(--pages-accent-3, #e8eaf6)" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5"/>
  <text x="35" y="54" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="system-ui">YAML</text>

  <text x="75" y="54" text-anchor="middle" fill="var(--pages-neutral-7, #aaa)" font-size="14">→</text>

  <rect x="85" y="30" width="60" height="40" rx="4" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
  <text x="115" y="54" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="system-ui">params</text>

  <text x="155" y="54" text-anchor="middle" fill="var(--pages-neutral-7, #aaa)" font-size="14">→</text>

  <rect x="165" y="30" width="60" height="40" rx="4" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
  <text x="195" y="54" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="system-ui">forEach</text>

  <text x="235" y="54" text-anchor="middle" fill="var(--pages-neutral-7, #aaa)" font-size="14">→</text>

  <rect x="245" y="30" width="60" height="40" rx="4" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
  <text x="275" y="54" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="system-ui">when</text>

  <text x="315" y="54" text-anchor="middle" fill="var(--pages-neutral-7, #aaa)" font-size="14">→</text>

  <rect x="325" y="30" width="60" height="40" rx="4" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
  <text x="355" y="54" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="system-ui">call</text>

  <text x="395" y="54" text-anchor="middle" fill="var(--pages-neutral-7, #aaa)" font-size="14">→</text>

  <rect x="405" y="30" width="50" height="40" rx="4" fill="var(--pages-accent-3, #e8eaf6)" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5"/>
  <text x="430" y="54" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="system-ui">plan</text>

  <text x="35" y="85" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">parse</text>
  <text x="115" y="85" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">resolve</text>
  <text x="195" y="85" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">expand</text>
  <text x="275" y="85" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">filter</text>
  <text x="355" y="85" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">inline</text>
  <text x="430" y="85" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">execute</text>
</svg>

**Pipeline stages:**

1. **YAML parse** — reads the scenario file, validates structure
2. **params resolve** — resolves `${params.*}` references against the variable chain (caller → defaults → config)
3. **forEach expand** — stamps steps once per data row, creating `${each.*}` bindings
4. **when filter** — evaluates conditional expressions, removes steps where `when` is falsy
5. **call inline** — resolves `call` commands against the script registry, inlines callee steps with name prefixing
6. **Execution plan** — flat list of resolved, concrete steps ready for dispatch to executors

Each stage is pure — it takes input and produces output without side effects. The pipeline runs at scenario start time, before any executor receives commands.
