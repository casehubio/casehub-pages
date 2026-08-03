import { getRegisteredStyles } from '../registry/stencil-registry.js';

export const DIAGRAM_ROOT_CLASS = 'diagram-root';

export function getIsolationCSS(): string {
  const pluginStyles = getRegisteredStyles();

  return `
.${DIAGRAM_ROOT_CLASS} {
  all: initial;
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.${DIAGRAM_ROOT_CLASS} * {
  all: revert;
}

${pluginStyles}

.react-flow__controls {
  background: var(--pages-neutral-1, #fafafa);
  border: 1px solid var(--pages-neutral-4, #ccc);
  border-radius: var(--pages-radius-md, 8px);
}
.react-flow__controls-button {
  background: var(--pages-neutral-1, #fafafa);
  border-bottom: 1px solid var(--pages-neutral-3, #ddd);
  color: var(--pages-text-primary, #111);
  fill: var(--pages-text-primary, #111);
}
.react-flow__controls-button:hover {
  background: var(--pages-neutral-2, #f0f0f0);
}
`.trim();
}

let refCount = 0;

export function injectIsolationStyles(): HTMLStyleElement {
  refCount++;

  const existing = document.head.querySelector('style[data-graph-isolation]');
  if (existing instanceof HTMLStyleElement) {
    existing.textContent = getIsolationCSS();
    return existing;
  }

  const style = document.createElement('style');
  style.setAttribute('data-graph-isolation', 'true');
  style.textContent = getIsolationCSS();
  document.head.appendChild(style);
  return style;
}

export function releaseIsolationStyles(): void {
  if (refCount <= 0) return;
  refCount--;
  if (refCount === 0) {
    document.head.querySelector('style[data-graph-isolation]')?.remove();
  }
}
