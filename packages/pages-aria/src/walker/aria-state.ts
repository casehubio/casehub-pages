import type { AriaState } from '@casehubio/pages-primitives';

function parseBool(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function getAriaState(element: Element): AriaState {
  return {
    busy: parseBool(element.getAttribute('aria-busy')),
    disabled: parseBool(element.getAttribute('aria-disabled')),
    expanded: parseBool(element.getAttribute('aria-expanded')),
    selected: parseBool(element.getAttribute('aria-selected')),
    checked: element.getAttribute('aria-checked') === 'mixed'
      ? 'mixed'
      : parseBool(element.getAttribute('aria-checked')),
    hidden: parseBool(element.getAttribute('aria-hidden')),
  };
}
