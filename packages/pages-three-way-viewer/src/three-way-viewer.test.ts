import { describe, it, expect, vi } from 'vitest';
import { ViewerController } from './viewer-controller.js';
import { isViewerSyncTarget } from './sync-protocol.js';

describe('three-way-viewer integration logic', () => {
  it('isViewerSyncTarget detects valid targets', () => {
    const target = { syncLine: vi.fn() };
    expect(isViewerSyncTarget(target)).toBe(true);
  });

  it('isViewerSyncTarget rejects invalid targets', () => {
    expect(isViewerSyncTarget(null)).toBe(false);
    expect(isViewerSyncTarget({})).toBe(false);
    expect(isViewerSyncTarget({ syncLine: 'not a function' })).toBe(false);
  });

  it('ViewerController integrates with mode-change dispatch', () => {
    const events: string[] = [];
    const vc = new ViewerController({
      initialMode: 'yaml',
      onChange: (mode) => { events.push(mode); },
    });
    vc.cycle();
    vc.cycle();
    expect(events).toEqual(['split', 'visual']);
  });

  it('ViewerController split ratio persists through mode changes', () => {
    const vc = new ViewerController({ initialMode: 'split' });
    vc.setSplitRatio(0.35);
    vc.setMode('yaml');
    vc.setMode('split');
    expect(vc.splitRatio).toBe(0.35);
  });
});
