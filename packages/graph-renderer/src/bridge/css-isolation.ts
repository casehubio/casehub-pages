import { getRegisteredStyles } from '../registry/node-registry.js';

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
`.trim();
}

export function injectIsolationStyles(): HTMLStyleElement {
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
