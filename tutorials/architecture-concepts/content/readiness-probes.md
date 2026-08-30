# Readiness Probes

Before running a script, the engine checks whether the current page has the elements the script needs. This is the **readiness probe**.

**How it works:**

1. The script's first step declares an ARIA target — e.g., `{role: textbox, name: "Full Name"}`
2. The library browser queries the DOM for that target
3. If found: the script is **ready** — it can run on this page
4. If not found: the script is **unavailable** — the page doesn't have the required UI

**Why first-step only?**

Checking every step would be expensive and fragile — later steps may target elements that only appear after earlier steps execute (a dialog opened by a click, a row added by a form submission). The first step is a reliable proxy: if the entry point exists, the script is likely compatible with this page.

**In the library browser:**

Ready scripts show a green indicator and can be launched immediately. Unavailable scripts show a grey indicator — they're visible for discovery but can't run until the user navigates to a compatible page.

**Readiness is live:** The probe re-runs when the DOM changes (via MutationObserver), so scripts become ready/unavailable as the user navigates without requiring a page refresh.
