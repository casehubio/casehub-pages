import { findAllByRole, getAriaState } from '../walker/index.js';
import type { AriaTarget, AriaState } from '@casehubio/pages-primitives';

export function resolveTarget(target: AriaTarget): Element {
  let scope: Element | undefined;

  if (target.within) {
    scope = resolveTarget(target.within);
  }

  const all = findAllByRole(target.role, target.name, scope);

  if (target.index != null) {
    const idx = typeof target.index === 'string' ? parseInt(target.index, 10) : target.index;
    if (idx < 0 || idx >= all.length) {
      const scopeDesc = target.within ? ` within ${target.within.role}` : '';
      throw new Error(`No element found: ${target.role} index ${idx}${scopeDesc} (found ${all.length})`);
    }
    return all[idx]!;
  }

  if (all.length === 0) {
    const scopeDesc = target.within ? ` within ${target.within.role} "${target.within.name ?? ''}"` : '';
    throw new Error(`No element found: ${target.role} "${target.name ?? ''}"${scopeDesc}`);
  }

  return all[0]!;
}

export function click(target: AriaTarget): void {
  const el = resolveTarget(target);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function fill(target: AriaTarget, value: string): void {
  const el = resolveTarget(target) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function select(target: AriaTarget, option: string): void {
  const el = resolveTarget(target) as HTMLSelectElement;
  el.value = option;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function expand(target: AriaTarget): void {
  const el = resolveTarget(target);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function collapse(target: AriaTarget): void {
  const el = resolveTarget(target);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function assertState(target: AriaTarget, expected: Partial<AriaState>): void {
  const el = resolveTarget(target);
  const actual = getAriaState(el);

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key as keyof AriaState];
    if (actualValue !== expectedValue) {
      throw new Error(
        `State mismatch for ${target.role} "${target.name}": ${key} expected ${String(expectedValue)}, got ${String(actualValue)}`
      );
    }
  }
}

export async function waitFor(
  target: AriaTarget,
  expected: Partial<AriaState>,
  timeout: number,
): Promise<void> {
  const deadline = Date.now() + timeout;
  const interval = 100;

  while (Date.now() < deadline) {
    try {
      assertState(target, expected);
      return;
    } catch {
      await new Promise(r => setTimeout(r, interval));
    }
  }

  assertState(target, expected);
}
