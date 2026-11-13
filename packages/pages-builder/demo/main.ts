import '@casehubio/pages-property-palette';
import '@casehubio/pages-code-editor';
import { injectTheme, applyThemeMode, DEFAULT_THEME } from '@casehubio/pages-ui-tokens';
import '../src/index.js';
import { PagesBuilderShell } from '../src/shell/builder-shell.js';

const SAMPLE_YAML = `pages:
- name: Color Grid
  properties:
    rowHeight: 60
  grid:
    - at: { x: 0, y: 0, w: 3, h: 2 }
      type: html
      properties:
        content: '<div style="background:#ef4444;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">A</div>'
    - at: { x: 3, y: 0, w: 3, h: 2 }
      type: html
      properties:
        content: '<div style="background:#f97316;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">B</div>'
    - at: { x: 6, y: 0, w: 3, h: 2 }
      type: html
      properties:
        content: '<div style="background:#eab308;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">C</div>'
    - at: { x: 9, y: 0, w: 3, h: 2 }
      type: html
      properties:
        content: '<div style="background:#22c55e;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">D</div>'
    - at: { x: 0, y: 2, w: 3, h: 2 }
      type: html
      properties:
        content: '<div style="background:#06b6d4;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">E</div>'
    - at: { x: 3, y: 2, w: 3, h: 2 }
      type: html
      properties:
        content: '<div style="background:#3b82f6;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">F</div>'
    - at: { x: 6, y: 2, w: 3, h: 2 }
      type: html
      properties:
        content: '<div style="background:#8b5cf6;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">G</div>'
    - at: { x: 9, y: 2, w: 3, h: 2 }
      type: html
      properties:
        content: '<div style="background:#ec4899;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">H</div>'
    - at: { x: 0, y: 4, w: 4, h: 2 }
      type: html
      properties:
        content: '<div style="background:#64748b;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">I</div>'
    - at: { x: 4, y: 4, w: 4, h: 2 }
      type: html
      properties:
        content: '<div style="background:#78716c;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">J</div>'
    - at: { x: 8, y: 4, w: 4, h: 2 }
      type: html
      properties:
        content: '<div style="background:#a3a3a3;border-radius:6px;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600">K</div>'
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
