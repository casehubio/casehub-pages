export interface PagesEventDetail<T = unknown> {
  readonly topic: string;
  readonly payload: T;
}

export function emitPagesEvent<T>(target: EventTarget, topic: string, payload: T): void {
  target.dispatchEvent(new CustomEvent('pages-event', {
    bubbles: true,
    composed: true,
    detail: { topic, payload } satisfies PagesEventDetail<T>,
  }));
}
