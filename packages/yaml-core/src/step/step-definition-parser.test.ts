import { describe, it, expect } from 'vitest';
import { StepDefinitionParser } from './step-definition-parser.js';

describe('StepDefinitionParser', () => {
  describe('enum alias for allowedValues', () => {
    it('reads allowedValues from "enum" key', () => {
      const params = StepDefinitionParser.parseParams({
        status: { type: 'STRING', enum: ['active', 'inactive'] },
      });
      expect(params['status']!.allowedValues).toEqual(['active', 'inactive']);
    });

    it('prefers allowedValues over enum when both present', () => {
      const params = StepDefinitionParser.parseParams({
        status: { type: 'STRING', allowedValues: ['a'], enum: ['b'] },
      });
      expect(params['status']!.allowedValues).toEqual(['a']);
    });
  });

  describe('kebab-case aliases', () => {
    it('reads structured-output on agent binding', () => {
      const binding = StepDefinitionParser.parseInvoke({
        agent: { descriptor: 'test-agent', 'structured-output': true },
      });
      expect(binding.kind).toBe('agent');
      if (binding.kind === 'agent') {
        expect(binding.structuredOutput).toBe(true);
      }
    });

    it('reads working-dir on process binding', () => {
      const binding = StepDefinitionParser.parseInvoke({
        process: { command: 'echo', 'working-dir': '/tmp' },
      });
      if (binding.kind === 'process') {
        expect(binding.workingDir).toBe('/tmp');
      }
    });

    it('reads on-error on process binding', () => {
      const binding = StepDefinitionParser.parseInvoke({
        process: { command: 'echo', 'on-error': 'ignore' },
      });
      if (binding.kind === 'process') {
        expect(binding.onError).toBe('ignore');
      }
    });

    it('reads working-dir on python shorthand', () => {
      const binding = StepDefinitionParser.parseInvoke({
        python: 'script.py', 'working-dir': '/opt',
      });
      if (binding.kind === 'script') {
        expect(binding.workingDir).toBe('/opt');
      }
    });
  });
});
