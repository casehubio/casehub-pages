import { describe, it, expect } from 'vitest';
import {
  createPlaybookSchemaRegistry,
  domainSchema,
  PLAYBOOK_CAPABILITIES,
} from './playbook-schema.js';

describe('PlaybookSchemaRegistry', () => {
  it('has client, server, and assisted built-in', () => {
    const registry = createPlaybookSchemaRegistry();
    expect(registry.isKnown('client')).toBe(true);
    expect(registry.isKnown('server')).toBe(true);
    expect(registry.isKnown('assisted')).toBe(true);
  });

  it('client has client-specific capabilities', () => {
    const registry = createPlaybookSchemaRegistry();
    const client = registry.resolve('client')!;

    expect(client.capabilities.has(PLAYBOOK_CAPABILITIES.STEPS)).toBe(true);
    expect(client.capabilities.has(PLAYBOOK_CAPABILITIES.ARIA)).toBe(true);
    expect(client.capabilities.has(PLAYBOOK_CAPABILITIES.CHAPTERS)).toBe(true);
    expect(client.capabilities.has(PLAYBOOK_CAPABILITIES.ORCHESTRATION)).toBe(false);
    expect(client.baseSchema).toBeNull();
  });

  it('server has server-specific capabilities', () => {
    const registry = createPlaybookSchemaRegistry();
    const server = registry.resolve('server')!;

    expect(server.capabilities.has(PLAYBOOK_CAPABILITIES.STEPS)).toBe(true);
    expect(server.capabilities.has(PLAYBOOK_CAPABILITIES.ORCHESTRATION)).toBe(true);
    expect(server.capabilities.has(PLAYBOOK_CAPABILITIES.CORRELATION)).toBe(true);
    expect(server.capabilities.has(PLAYBOOK_CAPABILITIES.ARIA)).toBe(false);
    expect(server.baseSchema).toBeNull();
  });

  it('registers domain schema', () => {
    const registry = createPlaybookSchemaRegistry();
    registry.register(domainSchema('clinical-server', 'server', ['clinical-trial']));

    const clinical = registry.resolve('clinical-server')!;
    expect(clinical.baseSchema).toBe('server');
    expect(clinical.capabilities.has('clinical-trial')).toBe(true);
  });

  it('unknown schema returns null', () => {
    const registry = createPlaybookSchemaRegistry();
    expect(registry.resolve('nonexistent')).toBeNull();
  });

  it('all() returns all registered', () => {
    const registry = createPlaybookSchemaRegistry();
    expect(registry.all()).toHaveLength(3);

    registry.register(domainSchema('aml-server', 'server', []));
    expect(registry.all()).toHaveLength(4);
  });

  it('assisted has server caps minus risk-bearing', () => {
    const registry = createPlaybookSchemaRegistry();
    const assisted = registry.resolve('assisted')!;

    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.ORCHESTRATION)).toBe(true);
    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.CORRELATION)).toBe(true);
    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.MCP_INVOKE)).toBe(true);
    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.GRAPHQL_INVOKE)).toBe(true);
    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.CODEGEN)).toBe(true);
    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.PROCESS_EXECUTION)).toBe(false);
    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.RAW_HTTP)).toBe(false);
    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.EXPRESSION_MVEL)).toBe(false);
    expect(assisted.capabilities.has(PLAYBOOK_CAPABILITIES.ENV_ACCESS)).toBe(false);
    expect(assisted.baseSchema).toBeNull();
  });

  it('server includes risk-bearing capabilities', () => {
    const registry = createPlaybookSchemaRegistry();
    const server = registry.resolve('server')!;

    expect(server.capabilities.has(PLAYBOOK_CAPABILITIES.PROCESS_EXECUTION)).toBe(true);
    expect(server.capabilities.has(PLAYBOOK_CAPABILITIES.RAW_HTTP)).toBe(true);
    expect(server.capabilities.has(PLAYBOOK_CAPABILITIES.EXPRESSION_MVEL)).toBe(true);
    expect(server.capabilities.has(PLAYBOOK_CAPABILITIES.ENV_ACCESS)).toBe(true);
  });

  it('server does not have TRIGGERS', () => {
    const registry = createPlaybookSchemaRegistry();
    const server = registry.resolve('server')!;
    expect(server.capabilities.has('triggers')).toBe(false);
  });

  it('hasCapability checks descriptor', () => {
    const registry = createPlaybookSchemaRegistry();
    const server = registry.resolve('server')!;
    expect(server.hasCapability(PLAYBOOK_CAPABILITIES.ORCHESTRATION)).toBe(true);
    expect(server.hasCapability(PLAYBOOK_CAPABILITIES.ARIA)).toBe(false);
  });
});
