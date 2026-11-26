import { describe, it, expect, vi } from 'vitest';
import { ViewerController } from './viewer-controller.js';

describe('ViewerController', () => {
  it('defaults to split mode with 0.5 ratio', () => {
    const vc = new ViewerController();
    expect(vc.mode).toBe('split');
    expect(vc.splitRatio).toBe(0.5);
  });

  it('accepts initial mode and ratio', () => {
    const vc = new ViewerController({ initialMode: 'yaml', initialSplitRatio: 0.3 });
    expect(vc.mode).toBe('yaml');
    expect(vc.splitRatio).toBe(0.3);
  });

  it('setMode changes mode and fires onChange', () => {
    const onChange = vi.fn();
    const vc = new ViewerController({ onChange });
    vc.setMode('visual');
    expect(vc.mode).toBe('visual');
    expect(onChange).toHaveBeenCalledWith('visual', 0.5);
  });

  it('setMode to same mode is a no-op', () => {
    const onChange = vi.fn();
    const vc = new ViewerController({ onChange });
    vc.setMode('split');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cycle rotates yaml → split → visual → yaml', () => {
    const vc = new ViewerController({ initialMode: 'yaml' });
    vc.cycle();
    expect(vc.mode).toBe('split');
    vc.cycle();
    expect(vc.mode).toBe('visual');
    vc.cycle();
    expect(vc.mode).toBe('yaml');
  });

  it('setSplitRatio clamps to [0.15, 0.85]', () => {
    const vc = new ViewerController();
    vc.setSplitRatio(0.05);
    expect(vc.splitRatio).toBe(0.15);
    vc.setSplitRatio(0.95);
    expect(vc.splitRatio).toBe(0.85);
    vc.setSplitRatio(0.6);
    expect(vc.splitRatio).toBe(0.6);
  });

  it('split ratio is remembered across mode changes', () => {
    const vc = new ViewerController();
    vc.setSplitRatio(0.7);
    vc.setMode('yaml');
    expect(vc.splitRatio).toBe(0.7);
    vc.setMode('split');
    expect(vc.splitRatio).toBe(0.7);
  });

  it('setSplitRatio fires onChange', () => {
    const onChange = vi.fn();
    const vc = new ViewerController({ onChange });
    vc.setSplitRatio(0.4);
    expect(onChange).toHaveBeenCalledWith('split', 0.4);
  });

  it('setSplitRatio to same value is a no-op', () => {
    const onChange = vi.fn();
    const vc = new ViewerController({ initialSplitRatio: 0.5, onChange });
    vc.setSplitRatio(0.5);
    expect(onChange).not.toHaveBeenCalled();
  });
});
