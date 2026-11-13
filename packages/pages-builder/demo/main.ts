import '@casehubio/pages-property-palette';
import '@casehubio/pages-code-editor';
import { injectTheme, applyThemeMode, DEFAULT_THEME } from '@casehubio/pages-ui-tokens';
import '../src/index.js';
import { PagesBuilderShell } from '../src/shell/builder-shell.js';

const s = (bg: string, label: string) => `background:${bg};border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600`;
const h = (bg: string, label: string) => `'<div style="${s(bg, label)}">${label}</div>'`;

const PAGES: Record<string, string> = {};

PAGES['Color Grid'] = `pages:
- name: Color Grid
  properties:
    rowHeight: 60
  grid:
    - { at: { x: 0, y: 0, w: 3, h: 2 }, type: html, properties: { content: ${h('#ef4444', 'A')} } }
    - { at: { x: 3, y: 0, w: 3, h: 2 }, type: html, properties: { content: ${h('#f97316', 'B')} } }
    - { at: { x: 6, y: 0, w: 3, h: 2 }, type: html, properties: { content: ${h('#eab308', 'C')} } }
    - { at: { x: 9, y: 0, w: 3, h: 2 }, type: html, properties: { content: ${h('#22c55e', 'D')} } }
    - { at: { x: 0, y: 2, w: 3, h: 2 }, type: html, properties: { content: ${h('#06b6d4', 'E')} } }
    - { at: { x: 3, y: 2, w: 3, h: 2 }, type: html, properties: { content: ${h('#3b82f6', 'F')} } }
    - { at: { x: 6, y: 2, w: 3, h: 2 }, type: html, properties: { content: ${h('#8b5cf6', 'G')} } }
    - { at: { x: 9, y: 2, w: 3, h: 2 }, type: html, properties: { content: ${h('#ec4899', 'H')} } }
    - { at: { x: 0, y: 4, w: 4, h: 2 }, type: html, properties: { content: ${h('#64748b', 'I')} } }
    - { at: { x: 4, y: 4, w: 4, h: 2 }, type: html, properties: { content: ${h('#78716c', 'J')} } }
    - { at: { x: 8, y: 4, w: 4, h: 2 }, type: html, properties: { content: ${h('#a3a3a3', 'K')} } }
`;

PAGES['Content Layout'] = `pages:
- name: Content Layout
  grid:
    - at: { x: 0, y: 0, w: 4, h: 2 }
      type: title
      properties:
        text: Revenue Overview
        size: h3
    - at: { x: 4, y: 0, w: 8, h: 2 }
      type: markdown
      properties:
        content: >
          Nested grid test — the panel below contains a nested grid.
          Try drag-and-drop inside the nested grid, and try dragging
          items between the parent and nested grids.
    - at: { x: 0, y: 2, w: 6, h: 4 }
      type: panel
      properties:
        title: Nested Grid Panel
      grid:
        - at: { x: 0, y: 0, w: 3, h: 2 }
          type: markdown
          properties:
            content: Nested A
        - at: { x: 3, y: 0, w: 3, h: 2 }
          type: markdown
          properties:
            content: Nested B
        - at: { x: 0, y: 2, w: 6, h: 1 }
          type: markdown
          properties:
            content: Nested C — full width
    - at: { x: 6, y: 2, w: 6, h: 4 }
      type: markdown
      properties:
        content: >
          Panel D — in the parent grid. Try dragging this into the
          nested grid panel on the left.
    - at: { x: 0, y: 6, w: 12, h: 2 }
      type: markdown
      properties:
        content: >
          Full-width panel — spans all 12 columns.
`;

PAGES['Two Forms'] = `pages:
- name: Two Forms
  properties:
    rowHeight: 60
  grid:
    - at: { x: 0, y: 0, w: 12, h: 1 }
      type: title
      properties:
        text: Patient Intake
        size: h2
    - at: { x: 0, y: 1, w: 6, h: 5 }
      type: panel
      properties:
        title: Personal Details
      grid:
        - { at: { x: 0, y: 0, w: 3, h: 1 }, type: html, properties: { content: ${h('#3b82f6', 'First Name')} } }
        - { at: { x: 3, y: 0, w: 3, h: 1 }, type: html, properties: { content: ${h('#3b82f6', 'Last Name')} } }
        - { at: { x: 0, y: 1, w: 6, h: 1 }, type: html, properties: { content: ${h('#60a5fa', 'Email')} } }
        - { at: { x: 0, y: 2, w: 3, h: 1 }, type: html, properties: { content: ${h('#60a5fa', 'Phone')} } }
        - { at: { x: 3, y: 2, w: 3, h: 1 }, type: html, properties: { content: ${h('#60a5fa', 'DOB')} } }
        - { at: { x: 0, y: 3, w: 6, h: 2 }, type: html, properties: { content: ${h('#93c5fd', 'Address')} } }
    - at: { x: 6, y: 1, w: 6, h: 5 }
      type: panel
      properties:
        title: Medical History
      grid:
        - { at: { x: 0, y: 0, w: 6, h: 1 }, type: html, properties: { content: ${h('#8b5cf6', 'Allergies')} } }
        - { at: { x: 0, y: 1, w: 3, h: 1 }, type: html, properties: { content: ${h('#a78bfa', 'Blood Type')} } }
        - { at: { x: 3, y: 1, w: 3, h: 1 }, type: html, properties: { content: ${h('#a78bfa', 'Weight')} } }
        - { at: { x: 0, y: 2, w: 6, h: 2 }, type: html, properties: { content: ${h('#c4b5fd', 'Conditions')} } }
        - { at: { x: 0, y: 4, w: 6, h: 1 }, type: html, properties: { content: ${h('#c4b5fd', 'Medications')} } }
    - { at: { x: 0, y: 6, w: 4, h: 2 }, type: html, properties: { content: ${h('#22c55e', 'Submit')} } }
    - { at: { x: 4, y: 6, w: 4, h: 2 }, type: html, properties: { content: ${h('#64748b', 'Save Draft')} } }
    - { at: { x: 8, y: 6, w: 4, h: 2 }, type: html, properties: { content: ${h('#ef4444', 'Cancel')} } }
`;

injectTheme(DEFAULT_THEME);
applyThemeMode(document.documentElement, 'dark');

const container = document.getElementById('builder-container')!;

const previewFetch: typeof globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : (input as Request).url;
  if (url.startsWith('/api/') || url.startsWith('http')) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return globalThis.fetch(input);
};

function createShell(yaml: string): void {
  container.innerHTML = '';
  const shell = document.createElement('pages-builder-shell') as PagesBuilderShell;
  shell.yaml = yaml;
  shell.renderPreview = async (el: HTMLElement, y: string) => {
    try {
      const { loadSite } = await import('@casehubio/pages-runtime');
      el.innerHTML = '';
      await loadSite(el, y, { fetch: previewFetch });
    } catch {
      el.innerHTML = '<div style="padding:24px;color:#5f6368;text-align:center;">Live preview requires pages-runtime with component bundles.</div>';
    }
  };
  container.appendChild(shell);
}

const pills = document.getElementById('page-pills')!;
const pageNames = Object.keys(PAGES);
let activePage = pageNames[0]!;

function switchPage(name: string): void {
  activePage = name;
  createShell(PAGES[name]!);
  for (const btn of pills.children) {
    (btn as HTMLElement).classList.toggle('active', btn.textContent === name);
  }
}

for (const name of pageNames) {
  const btn = document.createElement('button');
  btn.textContent = name;
  btn.className = name === activePage ? 'pill active' : 'pill';
  btn.addEventListener('click', () => switchPage(name));
  pills.appendChild(btn);
}

createShell(PAGES[activePage]!);
