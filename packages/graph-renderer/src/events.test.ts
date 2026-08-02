import { describe, it, expect, vi } from 'vitest';
import { emitPagesEvent } from './events.js';

describe('emitPagesEvent', () => {
  it('dispatches a pages-event CustomEvent', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    target.addEventListener('pages-event', handler);

    emitPagesEvent(target, 'graph:node-selected', { nodeId: '123' });

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe('pages-event');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
    expect(event.detail).toEqual({
      topic: 'graph:node-selected',
      payload: { nodeId: '123' },
    });
  });
});
