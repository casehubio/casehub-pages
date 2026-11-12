import '@casehubio/pages-property-palette';
import '@casehubio/pages-code-editor';
import { injectTheme, applyThemeMode, DEFAULT_THEME } from '@casehubio/pages-ui-tokens';
import '../src/index.js';
import { PagesBuilderShell } from '../src/shell/builder-shell.js';

const SAMPLE_YAML = `pages:
- name: Grid Layout
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

injectTheme(DEFAULT_THEME);
applyThemeMode(document.documentElement, 'dark');

const container = document.getElementById('builder-container')!;
const shell = document.createElement('pages-builder-shell') as PagesBuilderShell;
shell.yaml = SAMPLE_YAML;

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

shell.renderPreview = async (el: HTMLElement, yaml: string) => {
  try {
    const { loadSite } = await import('@casehubio/pages-runtime');
    el.innerHTML = '';
    await loadSite(el, yaml, { fetch: previewFetch });
  } catch {
    el.innerHTML = '<div style="padding:24px;color:#5f6368;text-align:center;">Live preview requires pages-runtime with component bundles.</div>';
  }
};

container.appendChild(shell);
