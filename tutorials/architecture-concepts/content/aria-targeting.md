# ARIA-Based Targeting

The browser executor finds UI elements using **ARIA roles and accessible names** — the same coordinate system used by screen readers. No `data-testid`, no CSS selectors, no XPath.

<svg viewBox="0 0 420 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; max-width: 420px;">
  <rect x="10" y="10" width="400" height="180" rx="6" fill="none" stroke="var(--pages-neutral-5, #d4d4d4)" stroke-width="1"/>
  <text x="20" y="30" fill="var(--pages-neutral-8, #999)" font-size="10" font-family="monospace">DOM Tree</text>

  <rect x="140" y="45" width="140" height="30" rx="4" fill="var(--pages-accent-3, #e8eaf6)" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5"/>
  <text x="210" y="64" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="11" font-family="monospace">role="textbox"</text>

  <rect x="30" y="100" width="160" height="30" rx="4" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
  <text x="110" y="119" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="monospace">name="Full Name"</text>

  <rect x="230" y="100" width="160" height="30" rx="4" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
  <text x="310" y="119" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="monospace">name="Email"</text>

  <rect x="30" y="155" width="160" height="30" rx="4" fill="var(--pages-accent-3, #e8eaf6)" stroke="var(--pages-accent-7, #6366f1)" stroke-width="2"/>
  <text x="110" y="174" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="10" font-family="monospace">index="1"</text>

  <line x1="180" y1="75" x2="110" y2="100" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
  <line x1="240" y1="75" x2="310" y2="100" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
  <line x1="110" y1="130" x2="110" y2="155" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1"/>
</svg>

**Targeting dimensions:**

- **`role`** — the element's ARIA role (`textbox`, `button`, `listbox`, `row`, `grid`)
- **`name`** — the accessible name from `aria-label` or `aria-labelledby`
- **`index`** — disambiguates when multiple elements share the same role and name
- **`within`** — scopes the search to descendants of a parent element

**Example target:**
```yaml
fill:
  role: textbox
  name: "Full Name"
  value: "Alice Chen"
```

This finds the element with `role="textbox"` and `aria-label="Full Name"`, then types "Alice Chen" into it.

**Why ARIA, not selectors?**

1. **Accessibility by construction** — if the automation can find an element, a screen reader can too
2. **Resilient to refactoring** — CSS classes and DOM structure change; roles and labels don't
3. **Universal** — works across frameworks (React, Lit, vanilla HTML) without adapter code
