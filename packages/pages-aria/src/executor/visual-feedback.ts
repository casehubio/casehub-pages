const STYLE_ID = 'scenario-feedback-styles';
const HIGHLIGHT_DURATION = 400;
const DEFAULT_TYPE_SPEED = 40;

const CSS = `
.scenario-highlight {
  outline: 2px solid rgba(56, 189, 248, 0.8) !important;
  outline-offset: 2px;
  animation: scenario-pulse 0.4s ease-out;
}
@keyframes scenario-pulse {
  0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); }
  100% { box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); }
}
.scenario-typing {
  outline: 2px solid rgba(134, 239, 172, 0.8) !important;
  outline-offset: 2px;
  box-shadow: 0 0 8px rgba(134, 239, 172, 0.3);
}
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function highlightElement(el: Element, _type: 'click' | 'fill' | 'select'): void {
  el.classList.add('scenario-highlight');
  setTimeout(() => {
    el.classList.remove('scenario-highlight');
  }, HIGHLIGHT_DURATION);
}

export async function typeText(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  speed = DEFAULT_TYPE_SPEED,
): Promise<void> {
  el.focus();
  el.classList.add('scenario-typing');

  for (let i = 1; i <= value.length; i++) {
    await new Promise<void>(r => setTimeout(r, speed));
    el.value = value.slice(0, i);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.classList.remove('scenario-typing');
}
