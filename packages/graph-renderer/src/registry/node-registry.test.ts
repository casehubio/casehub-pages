import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerNodeType,
  getNodeTypes,
  getRegisteredStyles,
  clearRegistry,
} from './node-registry.js';

const StubNode = (() => null) as unknown as import('@xyflow/react').NodeTypes[string];

describe('node-registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('starts empty', () => {
    expect(getNodeTypes()).toEqual({});
    expect(getRegisteredStyles()).toBe('');
  });

  it('registers a node type', () => {
    registerNodeType({ type: 'test-node', component: StubNode });
    const types = getNodeTypes();
    expect(types['test-node']).toBe(StubNode);
  });

  it('rejects duplicate type registration', () => {
    registerNodeType({ type: 'test-node', component: StubNode });
    expect(() => registerNodeType({ type: 'test-node', component: StubNode }))
      .toThrow('already registered');
  });

  it('collects styles from registered types', () => {
    registerNodeType({
      type: 'styled-node',
      component: StubNode,
      defaultStyle: '.styled-node { color: red; }',
    });
    expect(getRegisteredStyles()).toContain('.styled-node { color: red; }');
  });

  it('collects styles from multiple registrations', () => {
    registerNodeType({
      type: 'node-a',
      component: StubNode,
      defaultStyle: '.a { color: red; }',
    });
    registerNodeType({
      type: 'node-b',
      component: StubNode,
      defaultStyle: '.b { color: blue; }',
    });
    const styles = getRegisteredStyles();
    expect(styles).toContain('.a { color: red; }');
    expect(styles).toContain('.b { color: blue; }');
  });
});
