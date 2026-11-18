# Playbook Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #707 — Sync TS playbook port with platform WS-3, WS-4, WS-5 and recent changes
**Issue group:** #707, #673

**Goal:** Bring the TS `yaml-core` package to parity with platform playbook changes from WS-3 (trust model), WS-4 (canonical form), WS-5 (test infrastructure), and #726 (scalar subjects).

**Architecture:** Each batch ports one platform change area. Trust model is additive (new capabilities, new schema). Canonical form renames `forEach` → `for-each` across types, walker, and expanders. Scalar subjects extend the invoke binding parser. Test infrastructure adds validation and cross-parser fixtures.

**Tech Stack:** TypeScript, Vitest, yaml-core package

## Global Constraints

- All YAML keys use kebab-case (`for-each`, not `forEach`) per platform WS-4 canonical form
- TS function/class names stay camelCase (only YAML key string literals change)
- Cross-parser test fixtures must parse identically in Java and TS
- Run `yarn vitest run --project yaml-core` to verify after each task

---

## Batch 1: Trust Model (#830)

### Task 1: Add risk-bearing capabilities, ASSISTED schema, and query methods

**Files:**
- Modify: `packages/yaml-core/src/playbook-schema.ts`
- Modify: `packages/yaml-core/src/playbook-schema.test.ts`
- Modify: `packages/yaml-core/src/playbook.ts`

**Interfaces:**
- Produces: `PLAYBOOK_CAPABILITIES.PROCESS_EXECUTION`, `.RAW_HTTP`, `.EXPRESSION_MVEL`, `.ENV_ACCESS`
- Produces: `assisted` built-in schema in registry
- Produces: `hasCapability(cap)` on `PlaybookSchemaDescriptor`
- Produces: updated `isBuiltInSchema()` recognizing `assisted`

- [ ] **Step 1: Write failing tests for new capabilities and ASSISTED schema**

Add to `packages/yaml-core/src/playbook-schema.test.ts`:

```typescript
it('has assisted built-in', () => {
  const registry = createPlaybookSchemaRegistry();
  expect(registry.isKnown('assisted')).toBe(true);
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

it('all() returns 3 built-in schemas', () => {
  const registry = createPlaybookSchemaRegistry();
  expect(registry.all()).toHaveLength(3);
});

it('hasCapability checks descriptor', () => {
  const registry = createPlaybookSchemaRegistry();
  const server = registry.resolve('server')!;
  expect(server.hasCapability(PLAYBOOK_CAPABILITIES.ORCHESTRATION)).toBe(true);
  expect(server.hasCapability(PLAYBOOK_CAPABILITIES.ARIA)).toBe(false);
});
```

Add to `packages/yaml-core/src/playbook.test.ts` (create if missing):

```typescript
import { describe, it, expect } from 'vitest';
import { isBuiltInSchema, isDomainSchema } from './playbook.js';

describe('isBuiltInSchema', () => {
  it('recognizes all 3 built-ins', () => {
    expect(isBuiltInSchema('client')).toBe(true);
    expect(isBuiltInSchema('server')).toBe(true);
    expect(isBuiltInSchema('assisted')).toBe(true);
  });

  it('rejects domain schemas', () => {
    expect(isBuiltInSchema('clinical-server')).toBe(false);
  });
});

describe('isDomainSchema', () => {
  it('recognizes hyphenated non-built-in', () => {
    expect(isDomainSchema('clinical-server')).toBe(true);
    expect(isDomainSchema('aml-server')).toBe(true);
  });

  it('rejects built-ins and non-hyphenated', () => {
    expect(isDomainSchema('server')).toBe(false);
    expect(isDomainSchema('assisted')).toBe(false);
    expect(isDomainSchema('custom')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run --project yaml-core -- playbook-schema.test playbook.test`
Expected: FAIL — `PROCESS_EXECUTION` not defined, `assisted` not in registry, `hasCapability` not a function

- [ ] **Step 3: Implement trust model changes**

In `packages/yaml-core/src/playbook-schema.ts`:

1. Replace `TRIGGERS: 'triggers'` with the 4 risk-bearing capabilities:
```typescript
  // Risk-bearing capabilities (excluded from assisted authoring context)
  PROCESS_EXECUTION: 'process-execution',
  RAW_HTTP: 'raw-http',
  EXPRESSION_MVEL: 'expression-mvel',
  ENV_ACCESS: 'env-access',
```

2. Update `server` built-in to include risk-bearing, remove TRIGGERS:
```typescript
schemas.set('server', builtIn('server', [
  PLAYBOOK_CAPABILITIES.ORCHESTRATION,
  PLAYBOOK_CAPABILITIES.CORRELATION,
  PLAYBOOK_CAPABILITIES.MCP_INVOKE,
  PLAYBOOK_CAPABILITIES.GRAPHQL_INVOKE,
  PLAYBOOK_CAPABILITIES.CODEGEN,
  PLAYBOOK_CAPABILITIES.PROCESS_EXECUTION,
  PLAYBOOK_CAPABILITIES.RAW_HTTP,
  PLAYBOOK_CAPABILITIES.EXPRESSION_MVEL,
  PLAYBOOK_CAPABILITIES.ENV_ACCESS,
]));
```

3. Add `assisted` built-in (server caps minus risk-bearing):
```typescript
schemas.set('assisted', builtIn('assisted', [
  PLAYBOOK_CAPABILITIES.ORCHESTRATION,
  PLAYBOOK_CAPABILITIES.CORRELATION,
  PLAYBOOK_CAPABILITIES.MCP_INVOKE,
  PLAYBOOK_CAPABILITIES.GRAPHQL_INVOKE,
  PLAYBOOK_CAPABILITIES.CODEGEN,
]));
```

4. Add `hasCapability` to `PlaybookSchemaDescriptor`:
```typescript
export interface PlaybookSchemaDescriptor {
  name: string;
  baseSchema: string | null;
  capabilities: Set<string>;
  hasCapability(cap: string): boolean;
}
```

Update `builtIn` and `domainSchema` to include the method:
```typescript
function builtIn(name: string, extra: string[]): PlaybookSchemaDescriptor {
  const capabilities: Set<string> = new Set(SHARED_CAPABILITIES);
  for (const cap of extra) capabilities.add(cap);
  return { name, baseSchema: null, capabilities, hasCapability: (cap) => capabilities.has(cap) };
}

export function domainSchema(
  name: string,
  baseSchema: string,
  capabilities: string[],
): PlaybookSchemaDescriptor {
  const caps = new Set(capabilities);
  return { name, baseSchema, capabilities: caps, hasCapability: (cap) => caps.has(cap) };
}
```

In `packages/yaml-core/src/playbook.ts`:

1. Add `ASSISTED` to `PLAYBOOK_SCHEMAS`:
```typescript
export const PLAYBOOK_SCHEMAS = {
  CLIENT: 'client',
  SERVER: 'server',
  ASSISTED: 'assisted',
} as const;
```

2. Update `isBuiltInSchema`:
```typescript
export function isBuiltInSchema(schema: string): boolean {
  return schema === PLAYBOOK_SCHEMAS.CLIENT
    || schema === PLAYBOOK_SCHEMAS.SERVER
    || schema === PLAYBOOK_SCHEMAS.ASSISTED;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run --project yaml-core -- playbook-schema.test playbook.test`
Expected: PASS

- [ ] **Step 5: Run full yaml-core test suite**

Run: `yarn vitest run --project yaml-core`
Expected: PASS (no regressions from TRIGGERS removal)

- [ ] **Step 6: Commit**

```bash
git add packages/yaml-core/src/playbook-schema.ts packages/yaml-core/src/playbook-schema.test.ts packages/yaml-core/src/playbook.ts packages/yaml-core/src/playbook.test.ts
git commit -m "feat(#707): add trust model — risk-bearing capabilities, ASSISTED schema, remove TRIGGERS"
```

---

## Batch 2: Canonical Form (#833)

### Task 2: Rename forEach to for-each in walker, types, and expanders

**Files:**
- Modify: `packages/yaml-core/src/step/walker.ts:235,250,260` — set constants
- Modify: `packages/yaml-core/src/types.ts:154,155,268,275` — YamlImport interface, error messages
- Modify: `packages/yaml-core/src/import-expander.ts:27,45,47` — property access
- Modify: `packages/yaml-core/src/module-expander.ts:79` — property access
- Modify: `packages/yaml-core/src/foreach-expander.ts:42` — resolver context string
- Modify: `packages/yaml-core/src/step/walker.test.ts` — YAML fixtures
- Modify: `packages/yaml-core/src/foreach-expander.test.ts` — YAML fixtures
- Modify: `packages/yaml-core/src/import-expander.test.ts` — YAML fixtures
- Modify: `packages/yaml-core/src/module-expander.test.ts` — YAML fixtures

**Interfaces:**
- Modifies: `YamlImport` interface — `forEach` property becomes `'for-each'`
- Modifies: `RESERVED_KEYS`, `DECORATOR_KEYS`, `PROMOTABLE_DECORATORS` — `'forEach'` becomes `'for-each'`

- [ ] **Step 1: Update walker constants**

In `packages/yaml-core/src/step/walker.ts`, change all 3 occurrences of `'forEach'` to `'for-each'`:

Line 235 (RESERVED_KEYS): `'forEach'` → `'for-each'`
Line 250 (DECORATOR_KEYS): `'forEach'` → `'for-each'`
Line 260 (PROMOTABLE_DECORATORS): `'forEach'` → `'for-each'`

- [ ] **Step 2: Update YamlImport interface and error messages**

In `packages/yaml-core/src/types.ts`:

Line 154 — change `forEach` property to bracket notation:
```typescript
export interface YamlImport {
  module?: string | undefined;
  actions?: string | undefined;
  as: string;
  condition?: string | undefined;
  parameters: Record<string, string>;
  'for-each'?: unknown;
  loop?: unknown;
}
```

Line 268 — update error message:
```typescript
if (!as) throw new Error("Inline for-each 'as' variable name is required");
```

Line 275 — update error message:
```typescript
throw new Error(
  `Invalid for-each value: expected string, {as, in} map, or ForEachDirective — got ${typeof raw}`,
);
```

- [ ] **Step 3: Update import-expander.ts property access**

Line 27: `element.forEach` → `element['for-each']`
```typescript
getForEach(element) {
  return parseForEachDirective(element['for-each'] ?? null);
},
```

Line 44-48 — update `normaliseForEach`:
```typescript
function normaliseForEach(imp: YamlImport): YamlImport {
  if (imp['for-each'] != null) return imp;
  if (imp.loop != null) {
    return { ...imp, 'for-each': loopToForEach(imp.loop), loop: undefined };
  }
  return imp;
}
```

- [ ] **Step 4: Update module-expander.ts property access**

Line 79: `imp.forEach` → `imp['for-each']`
```typescript
if (imp.as.includes('.') && (imp['for-each'] != null || imp.loop != null)) {
```

- [ ] **Step 5: Update foreach-expander.ts resolver context**

Line 42: change resolver context string:
```typescript
s = resolver.resolveString(s, `for-each.${context}`);
```

- [ ] **Step 6: Update all test files**

In every test file that uses `forEach` as a YAML key or property access, replace with `for-each`/`'for-each'`:

- `packages/yaml-core/src/step/walker.test.ts` — YAML object keys `forEach:` → `'for-each':`
- `packages/yaml-core/src/foreach-expander.test.ts` — test objects with `forEach` property → `'for-each'`
- `packages/yaml-core/src/import-expander.test.ts` — YamlImport test objects
- `packages/yaml-core/src/module-expander.test.ts` — YamlImport test objects

For each test file: search for `forEach` (excluding `.forEach(` array method calls), replace property names with bracket notation `'for-each'`.

- [ ] **Step 7: Run test suite**

Run: `yarn vitest run --project yaml-core`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/yaml-core/src/
git commit -m "feat(#707): canonical form — rename forEach to for-each in types, walker, expanders"
```

---

## Batch 3: Scalar Subjects (#726)

### Task 3: Add scalar string handling for graphql, rest, and mcp invoke bindings

**Files:**
- Modify: `packages/yaml-core/src/step/definition-parser.ts:71-72,102-113`
- Modify: `packages/yaml-core/src/step/definition-parser.test.ts`

**Interfaces:**
- Modifies: `DefinitionParser.parseInvoke()` — scalar string accepted for `graphql`, `rest`, `mcp`

- [ ] **Step 1: Write failing tests for scalar invoke bindings**

Add to `packages/yaml-core/src/step/definition-parser.test.ts`:

```typescript
describe('scalar invoke bindings', () => {
  it('graphql accepts scalar query string', () => {
    const result = DefinitionParser.parseInvoke({ graphql: '{ users { name } }' });
    expect(result).toEqual({ kind: 'graphql', query: '{ users { name } }' });
  });

  it('mcp accepts scalar tool name', () => {
    const result = DefinitionParser.parseInvoke({ mcp: 'search-docs' });
    expect(result).toEqual({ kind: 'mcp', tool: 'search-docs' });
  });

  it('rest accepts scalar URL string', () => {
    const result = DefinitionParser.parseInvoke({ rest: 'https://api.example.com/users' });
    expect(result).toEqual({
      kind: 'rest',
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: {},
      body: {},
    });
  });

  it('graphql still accepts map form', () => {
    const result = DefinitionParser.parseInvoke({ graphql: '{ users { name } }' });
    expect(result.kind).toBe('graphql');
  });

  it('rest still accepts map form', () => {
    const result = DefinitionParser.parseInvoke({
      rest: { method: 'POST', url: 'https://api.example.com/users', headers: {}, body: {} },
    });
    expect(result).toEqual({
      kind: 'rest',
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: {},
      body: {},
    });
  });

  it('mcp still accepts map form', () => {
    const result = DefinitionParser.parseInvoke({ mcp: 'search-docs' });
    expect(result.kind).toBe('mcp');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run --project yaml-core -- definition-parser.test`
Expected: FAIL — scalar string not handled for graphql map form, rest scalar

- [ ] **Step 3: Implement scalar handling**

In `packages/yaml-core/src/step/definition-parser.ts`, update `parseInvoke`:

For `mcp` (line 71-72) — already handles scalar (mcp value is treated as string directly):
```typescript
if (raw['mcp']) {
  const val = raw['mcp'];
  if (typeof val === 'string') return { kind: 'mcp', tool: val };
  const spec = val as Record<string, unknown>;
  return { kind: 'mcp', tool: spec['tool'] as string };
}
```

For `graphql` (line 102-103) — the existing code already treats `raw['graphql']` as a string, which works for scalar. Verify the test passes as-is; if the value could be a map, add the scalar check:
```typescript
if (raw['graphql']) {
  const val = raw['graphql'];
  if (typeof val === 'string') return { kind: 'graphql', query: val };
  const spec = val as Record<string, unknown>;
  return { kind: 'graphql', query: spec['query'] as string };
}
```

For `rest` (line 105-113) — add scalar string handling:
```typescript
if (raw['rest']) {
  const val = raw['rest'];
  if (typeof val === 'string') {
    return { kind: 'rest', method: 'GET', url: val, headers: {}, body: {} };
  }
  const spec = val as Record<string, unknown>;
  return {
    kind: 'rest',
    method: (spec['method'] as string) ?? 'GET',
    url: spec['url'] as string,
    headers: (spec['headers'] as Record<string, string>) ?? {},
    body: (spec['body'] as Record<string, string>) ?? {},
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run --project yaml-core -- definition-parser.test`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `yarn vitest run --project yaml-core`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/yaml-core/src/step/definition-parser.ts packages/yaml-core/src/step/definition-parser.test.ts
git commit -m "feat(#707): scalar subjects — graphql, rest, mcp accept string values"
```

---

## Batch 4: Test Infrastructure (#834, #850)

### Task 4: Add tutorial header validation and category cross-parser fixtures

**Files:**
- Modify: `packages/yaml-core/src/test/plugins/validate-playbook-plugin.ts` — header validation
- Create: `test/cross-parser/fixtures/playbook-tutorial-headers.yaml` — cross-parser fixture
- Create: `test/cross-parser/fixtures/playbook-category-patterns.yaml` — category pattern fixtures
- Modify: `packages/yaml-core/src/playbook.ts` — `parseTutorialHeaders()` helper
- Create: `packages/yaml-core/src/playbook.test.ts` — if not already created in Batch 1

**Interfaces:**
- Produces: `parseTutorialHeaders(meta)` — extracts level, layer, teaches, builds-on
- Produces: `validateTutorialHeaders(meta)` — returns validation errors

- [ ] **Step 1: Write failing tests for tutorial header parsing**

Add to `packages/yaml-core/src/playbook.test.ts`:

```typescript
import { parseTutorialHeaders, validateTutorialHeaders } from './playbook.js';

describe('parseTutorialHeaders', () => {
  it('extracts all 4 fields from meta block', () => {
    const meta = { level: 2, layer: 'flow-control', teaches: 'retry with limits', 'builds-on': 'sequential' };
    const headers = parseTutorialHeaders(meta);
    expect(headers).toEqual({
      level: 2,
      layer: 'flow-control',
      teaches: 'retry with limits',
      buildsOn: 'sequential',
    });
  });

  it('handles builds-on as array', () => {
    const meta = { level: 3, layer: 'composition', teaches: 'module composition', 'builds-on': ['sequential', 'retry'] };
    const headers = parseTutorialHeaders(meta);
    expect(headers.buildsOn).toEqual(['sequential', 'retry']);
  });

  it('returns null builds-on for level-1 fundamentals', () => {
    const meta = { level: 1, layer: 'flow-control', teaches: 'running steps in order' };
    const headers = parseTutorialHeaders(meta);
    expect(headers.buildsOn).toBeNull();
  });
});

describe('validateTutorialHeaders', () => {
  it('passes for valid headers', () => {
    const meta = { level: 2, layer: 'flow-control', teaches: 'retry' };
    expect(validateTutorialHeaders(meta)).toEqual([]);
  });

  it('reports missing required fields', () => {
    const errors = validateTutorialHeaders({ level: 2 });
    expect(errors).toContain("Missing required tutorial header: 'layer'");
    expect(errors).toContain("Missing required tutorial header: 'teaches'");
  });

  it('reports invalid level range', () => {
    const errors = validateTutorialHeaders({ level: 7, layer: 'x', teaches: 'y' });
    expect(errors).toContain("Tutorial header 'level' must be 1-5, got 7");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run --project yaml-core -- playbook.test`
Expected: FAIL — functions not defined

- [ ] **Step 3: Implement tutorial header functions**

In `packages/yaml-core/src/playbook.ts`:

```typescript
export interface TutorialHeaders {
  level: number;
  layer: string;
  teaches: string;
  buildsOn: string | string[] | null;
}

export function parseTutorialHeaders(meta: Record<string, unknown>): TutorialHeaders {
  return {
    level: meta['level'] as number,
    layer: meta['layer'] as string,
    teaches: meta['teaches'] as string,
    buildsOn: (meta['builds-on'] as string | string[] | undefined) ?? null,
  };
}

export function validateTutorialHeaders(meta: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (meta['level'] == null) {
    errors.push("Missing required tutorial header: 'level'");
  } else {
    const level = meta['level'] as number;
    if (level < 1 || level > 5) {
      errors.push(`Tutorial header 'level' must be 1-5, got ${level}`);
    }
  }
  if (meta['layer'] == null) errors.push("Missing required tutorial header: 'layer'");
  if (meta['teaches'] == null) errors.push("Missing required tutorial header: 'teaches'");
  return errors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run --project yaml-core -- playbook.test`
Expected: PASS

- [ ] **Step 5: Add cross-parser fixtures**

Create `test/cross-parser/fixtures/playbook-tutorial-headers.yaml`:

```yaml
playbook: "1.0"
schema: server
name: retry-example
meta:
  title: "Retry"
  description: "Demonstrates retry with configurable limits"
  tags: [retry, decorator, flow-control]
  level: 2
  layer: flow-control
  teaches: "retrying failed steps with configurable limits"
  builds-on: sequential
```

Create `test/cross-parser/fixtures/playbook-category-patterns.yaml`:

```yaml
playbook: "1.0"
schema: server
name: for-each-composition
meta:
  title: "For-Each Composition"
  level: 3
  layer: composition
  teaches: "iterating over collections with for-each"
  builds-on: [sequential, modules]
---
sections:
  steps:
    step-1:
      action: log
      for-each:
        as: item
        in: [a, b, c]
```

- [ ] **Step 6: Run full test suite including cross-parser**

Run: `yarn vitest run --project yaml-core`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/yaml-core/src/playbook.ts packages/yaml-core/src/playbook.test.ts test/cross-parser/fixtures/
git commit -m "feat(#707): tutorial headers and cross-parser fixtures for category patterns"
```

---

## References

- [docs/specs/issue-707-playbook-sync/2026-11-18-playbook-sync-design.md] — design spec
- [packages/yaml-core/src/playbook-schema.ts] — current capabilities and registry
- [packages/yaml-core/src/types.ts:148-156] — YamlImport interface with forEach
- [packages/yaml-core/src/step/walker.ts:232-260] — RESERVED/DECORATOR/PROMOTABLE sets
- [packages/yaml-core/src/step/definition-parser.ts:70-192] — invoke binding parser
- [packages/yaml-core/src/import-expander.ts:26-49] — forEach property access
- [packages/yaml-core/src/module-expander.ts:79] — forEach property access
- [packages/yaml-core/src/foreach-expander.ts:42] — resolver context string
- [packages/yaml-core/src/playbook.ts:13-20] — PLAYBOOK_SCHEMAS and isBuiltInSchema
- [platform PlaybookCapabilities.java] — canonical capability list
- [platform PlaybookSchemas.java] — isBuiltIn, isDomainSchema
- [platform MapPlaybookSchemaRegistry.java] — ASSISTED definition
- [platform DeclarationParser.java:126-144] — scalar subject handling
- [platform docs/specs/issue-834-rules-headers-lint-playbook-tests/] — test conventions spec
- [GitHub #707] — focal issue
- [GitHub #673] — companion: YAML file forEach→for-each renames
- [GitHub #669] — parent: playbook language direction
