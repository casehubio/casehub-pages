import { describe, it, expect } from 'vitest';
import { computeMenuItems } from './tree-context-menu.js';

describe('computeMenuItems', () => {
  it('grid-item menu does not include split actions', () => {
    const items = computeMenuItems('grid-item', false);
    const actions = items.map(i => i.action).filter(Boolean);
    expect(actions).not.toContain('split-horizontal');
    expect(actions).not.toContain('split-vertical');
  });

  it('grid-item menu still includes move and delete', () => {
    const items = computeMenuItems('grid-item', false);
    const actions = items.map(i => i.action).filter(Boolean);
    expect(actions).toContain('move-up');
    expect(actions).toContain('move-down');
    expect(actions).toContain('delete');
  });

  it('component menu is unaffected', () => {
    const items = computeMenuItems('component', false);
    const actions = items.map(i => i.action).filter(Boolean);
    expect(actions).toContain('duplicate');
    expect(actions).toContain('delete');
  });
});
