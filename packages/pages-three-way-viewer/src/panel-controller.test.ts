import { describe, it, expect, vi } from 'vitest';
import { PanelController } from './panel-controller.js';

describe('PanelController', () => {
  it('defaults to closed', () => {
    const c = new PanelController();
    expect(c.mode).toBe('closed');
  });

  it('respects custom initial mode', () => {
    const c = new PanelController({ initialMode: 'docked' });
    expect(c.mode).toBe('docked');
  });

  it('setMode changes mode and fires onChange', () => {
    const onChange = vi.fn();
    const c = new PanelController({ onChange });
    c.setMode('docked');
    expect(c.mode).toBe('docked');
    expect(onChange).toHaveBeenCalledWith('docked');
  });

  it('setMode with same mode is a no-op', () => {
    const onChange = vi.fn();
    const c = new PanelController({ initialMode: 'docked', onChange });
    c.setMode('docked');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggle from closed goes to docked', () => {
    const c = new PanelController();
    c.toggle();
    expect(c.mode).toBe('docked');
  });

  it('toggle from docked goes to closed', () => {
    const c = new PanelController({ initialMode: 'docked' });
    c.toggle();
    expect(c.mode).toBe('closed');
  });

  it('toggle from floating goes to closed', () => {
    const c = new PanelController({ initialMode: 'floating' });
    c.toggle();
    expect(c.mode).toBe('closed');
  });
});
