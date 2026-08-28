import { describe, it, expect } from 'vitest';
import { PagesEventTrail } from './pages-event-trail.js';

describe('PagesEventTrail', () => {
  it('exports the class', () => {
    expect(PagesEventTrail).toBeDefined();
    expect(typeof PagesEventTrail).toBe('function');
  });
});
