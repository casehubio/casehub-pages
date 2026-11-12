# Expression System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #641 — Phase 3: expression system (type-aware resolution)
**Issue group:** #641, #608

**Goal:** Add a pluggable expression engine system to TS yaml-core that routes `ParameterType.EXPRESSION` params through compiled expression evaluation instead of string interpolation, with JQ and JS engines.

**Architecture:** Parallel resolution path alongside VariableResolver's `${}` interpolation. Plugin schemas declare `type: EXPRESSION` to route params through `ExpressionEngineRegistry` → `CompiledExpression.eval(context)`. VariableResolver gains `scopeContainers` for building expression contexts via `withExpressionContext()` / `buildExpressionContext()`. Two concrete engines: JQ (via `@sscots/jqjs`) and JS (via `new Function` with null-prototype context).

**Tech Stack:** TypeScript, Vitest, `@sscots/jqjs` (pure JS JQ implementation, 76.7 kB)

## Global Constraints

- All new code goes in `packages/yaml-core/src/expression/` with barrel export from `index.ts`
- Follow existing yaml-core patterns: immutable VariableResolver, interface-first design, Vitest tests
- `validate()` throws on invalid syntax (matching Java), does NOT return boolean
- `ExpressionContext` has 4 values: `CONDITION`, `TRANSFORM`, `FILTER`, `PARAMETER`
- Unsupported engines return `DescriptiveExpression` (no throw) — browser preview pattern
- Expression caching by `(engineType, expression)` key with `clearCache()` eviction
- `${}` stripping for EXPRESSION params: `${expr}` → `expr` before evaluation

---

## Batch 1: Expression Engine Interfaces + Registry

### Task 1: ExpressionEngine, CompiledExpression, ExpressionContext interfaces

**Files:**
- Create: `packages/yaml-core/src/expression/expression-engine.ts`
- Create: `packages/yaml-core/src/expression/compiled-expression.ts`
- Create: `packages/yaml-core/src/expression/expression-context.ts`
- Test: `packages/yaml-core/src/expression/expression-engine.test.ts`

**Interfaces:**
- Produces: `ExpressionEngine { type: string; compile(expression: string): CompiledExpression; validate(expression: string): void; }`, `CompiledExpression<R = unknown> { type: string; eval(context: Record<string, unknown>): R; }`, `ExpressionContext = 'CONDITION' | 'TRANSFORM' | 'FILTER' | 'PARAMETER'`, `ExpressionDescription { engine: string; expression: string; context: Record<string, unknown>; status: 'not-available'; }`

- [ ] **Step 1: Write the type definitions**

```typescript
// expression-context.ts
export type ExpressionContext = 'CONDITION' | 'TRANSFORM' | 'FILTER' | 'PARAMETER';
```

```typescript
// compiled-expression.ts
export interface CompiledExpression<R = unknown> {
  readonly type: string;
  eval(context: Record<string, unknown>): R;
}
```

```typescript
// expression-engine.ts
import type { CompiledExpression } from './compiled-expression.js';

export interface ExpressionEngine {
  readonly type: string;
  compile(expression: string): CompiledExpression;
  validate(expression: string): void;
}
```

- [ ] **Step 2: Write ExpressionDescription type and DescriptiveExpression class**

```typescript
// In compiled-expression.ts, add:

export interface ExpressionDescription {
  engine: string;
  expression: string;
  context: Record<string, unknown>;
  status: 'not-available';
}

export class DescriptiveExpression implements CompiledExpression<ExpressionDescription> {
  readonly type = 'descriptive';

  constructor(
    private readonly requestedType: string,
    private readonly expression: string,
  ) {}

  eval(context: Record<string, unknown>): ExpressionDescription {
    return {
      engine: this.requestedType,
      expression: this.expression,
      context,
      status: 'not-available' as const,
    };
  }
}
```

- [ ] **Step 3: Write test for DescriptiveExpression**

```typescript
// expression-engine.test.ts
import { describe, it, expect } from 'vitest';
import { DescriptiveExpression } from './compiled-expression.js';

describe('DescriptiveExpression', () => {
  it('returns structured description with not-available status', () => {
    const expr = new DescriptiveExpression('mvel', 'x > 0');
    const ctx = { x: 42 };
    const result = expr.eval(ctx);

    expect(result).toEqual({
      engine: 'mvel',
      expression: 'x > 0',
      context: { x: 42 },
      status: 'not-available',
    });
  });

  it('has type descriptive', () => {
    const expr = new DescriptiveExpression('mvel', 'x > 0');
    expect(expr.type).toBe('descriptive');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/expression-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/yaml-core/src/expression/
git commit -m "feat(#641): ExpressionEngine, CompiledExpression, ExpressionContext interfaces

Add expression system type definitions:
- ExpressionEngine interface (type, compile, validate)
- CompiledExpression<R> interface (type, eval)
- ExpressionContext type (CONDITION, TRANSFORM, FILTER, PARAMETER)
- DescriptiveExpression for unsupported engine fallback
- ExpressionDescription type for structured not-available output

Refs #641"
```

### Task 2: DefaultExpressionEngineRegistry with caching

**Files:**
- Create: `packages/yaml-core/src/expression/expression-engine-registry.ts`
- Modify: `packages/yaml-core/src/expression/expression-engine.test.ts` (add registry tests)

**Interfaces:**
- Consumes: `ExpressionEngine`, `CompiledExpression`, `ExpressionContext`, `DescriptiveExpression` from Task 1
- Produces: `ExpressionEngineRegistry { register(engine: ExpressionEngine): void; resolve(type: string): ExpressionEngine | undefined; compile(type: string, expression: string): CompiledExpression; registerDefault(context: ExpressionContext, engineType: string): void; resolveDefault(context: ExpressionContext): string | undefined; clearCache(): void; }`, `DefaultExpressionEngineRegistry` class

- [ ] **Step 1: Write failing tests for the registry**

```typescript
// Append to expression-engine.test.ts
import { DefaultExpressionEngineRegistry } from './expression-engine-registry.js';
import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';

function stubEngine(engineType: string): ExpressionEngine {
  return {
    type: engineType,
    compile(expression: string): CompiledExpression {
      return {
        type: engineType,
        eval(context) { return `${engineType}:${expression}:${JSON.stringify(context)}`; },
      };
    },
    validate(_expression: string): void { /* no-op */ },
  };
}

describe('DefaultExpressionEngineRegistry', () => {
  it('registers and resolves engines by type', () => {
    const registry = new DefaultExpressionEngineRegistry();
    const engine = stubEngine('test');
    registry.register(engine);
    expect(registry.resolve('test')).toBe(engine);
  });

  it('returns undefined for unregistered engine type', () => {
    const registry = new DefaultExpressionEngineRegistry();
    expect(registry.resolve('unknown')).toBeUndefined();
  });

  it('compiles via registered engine', () => {
    const registry = new DefaultExpressionEngineRegistry();
    registry.register(stubEngine('test'));
    const compiled = registry.compile('test', 'x + 1');
    expect(compiled.type).toBe('test');
    expect(compiled.eval({ x: 1 })).toBe('test:x + 1:{"x":1}');
  });

  it('returns DescriptiveExpression for unknown engine type', () => {
    const registry = new DefaultExpressionEngineRegistry();
    const compiled = registry.compile('mvel', '.items');
    expect(compiled.type).toBe('descriptive');
    const result = compiled.eval({ items: [1] });
    expect(result).toEqual({
      engine: 'mvel',
      expression: '.items',
      context: { items: [1] },
      status: 'not-available',
    });
  });

  it('caches compiled expressions by type+expression key', () => {
    const registry = new DefaultExpressionEngineRegistry();
    const engine = stubEngine('test');
    let compileCount = 0;
    engine.compile = (expr) => {
      compileCount++;
      return { type: 'test', eval: () => expr };
    };
    registry.register(engine);

    const a = registry.compile('test', 'x + 1');
    const b = registry.compile('test', 'x + 1');
    expect(a).toBe(b);
    expect(compileCount).toBe(1);
  });

  it('clears cache on clearCache()', () => {
    const registry = new DefaultExpressionEngineRegistry();
    let compileCount = 0;
    const engine = stubEngine('test');
    engine.compile = (expr) => {
      compileCount++;
      return { type: 'test', eval: () => expr };
    };
    registry.register(engine);

    registry.compile('test', 'x + 1');
    registry.clearCache();
    registry.compile('test', 'x + 1');
    expect(compileCount).toBe(2);
  });

  it('registers and resolves default engine for context', () => {
    const registry = new DefaultExpressionEngineRegistry();
    registry.registerDefault('CONDITION', 'js');
    expect(registry.resolveDefault('CONDITION')).toBe('js');
  });

  it('returns undefined for context with no default', () => {
    const registry = new DefaultExpressionEngineRegistry();
    expect(registry.resolveDefault('CONDITION')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/expression-engine.test.ts`
Expected: FAIL — `DefaultExpressionEngineRegistry` not found

- [ ] **Step 3: Implement DefaultExpressionEngineRegistry**

```typescript
// expression-engine-registry.ts
import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';
import { DescriptiveExpression } from './compiled-expression.js';
import type { ExpressionContext } from './expression-context.js';

export interface ExpressionEngineRegistry {
  register(engine: ExpressionEngine): void;
  resolve(type: string): ExpressionEngine | undefined;
  compile(type: string, expression: string): CompiledExpression;
  registerDefault(context: ExpressionContext, engineType: string): void;
  resolveDefault(context: ExpressionContext): string | undefined;
  clearCache(): void;
}

export class DefaultExpressionEngineRegistry implements ExpressionEngineRegistry {
  private readonly engines = new Map<string, ExpressionEngine>();
  private readonly defaults = new Map<ExpressionContext, string>();
  private readonly cache = new Map<string, CompiledExpression>();

  register(engine: ExpressionEngine): void {
    this.engines.set(engine.type, engine);
  }

  resolve(type: string): ExpressionEngine | undefined {
    return this.engines.get(type);
  }

  compile(type: string, expression: string): CompiledExpression {
    const key = `${type}:${expression}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const engine = this.engines.get(type);
    if (!engine) return new DescriptiveExpression(type, expression);

    const compiled = engine.compile(expression);
    this.cache.set(key, compiled);
    return compiled;
  }

  registerDefault(context: ExpressionContext, engineType: string): void {
    this.defaults.set(context, engineType);
  }

  resolveDefault(context: ExpressionContext): string | undefined {
    return this.defaults.get(context);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/expression-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/yaml-core/src/expression/
git commit -m "feat(#641): DefaultExpressionEngineRegistry with caching and descriptive fallback

Registry dispatches compile() to engines by type key, caches compiled
expressions by (type, expression), returns DescriptiveExpression for
unknown engine types. Supports default engine mapping per ExpressionContext.

Refs #641"
```

## Batch 2: Concrete Engines (JQ + JS)

### Task 3: JqExpressionEngine

**Files:**
- Create: `packages/yaml-core/src/expression/jq-expression-engine.ts`
- Test: `packages/yaml-core/src/expression/jq-expression-engine.test.ts`

**Interfaces:**
- Consumes: `ExpressionEngine`, `CompiledExpression` from Task 1
- Produces: `JqExpressionEngine` class (type = `'jq'`)

**Prerequisite:** Install `@sscots/jqjs` dependency.

- [ ] **Step 1: Add jqjs dependency**

Run: `yarn workspace @casehubio/yaml-core add @sscots/jqjs`

- [ ] **Step 2: Write failing tests**

```typescript
// jq-expression-engine.test.ts
import { describe, it, expect } from 'vitest';
import { JqExpressionEngine } from './jq-expression-engine.js';

describe('JqExpressionEngine', () => {
  const engine = new JqExpressionEngine();

  it('has type jq', () => {
    expect(engine.type).toBe('jq');
  });

  describe('compile + eval', () => {
    it('evaluates identity expression', () => {
      const compiled = engine.compile('.');
      expect(compiled.eval({ x: 1 })).toEqual({ x: 1 });
    });

    it('evaluates field access', () => {
      const compiled = engine.compile('.name');
      expect(compiled.eval({ name: 'Alice' })).toBe('Alice');
    });

    it('evaluates arithmetic', () => {
      const compiled = engine.compile('.a + .b');
      expect(compiled.eval({ a: 3, b: 4 })).toBe(7);
    });

    it('evaluates pipe filter', () => {
      const compiled = engine.compile('.items | length');
      expect(compiled.eval({ items: [1, 2, 3] })).toBe(3);
    });

    it('evaluates object construction', () => {
      const compiled = engine.compile('{ total: (.a + .b) }');
      expect(compiled.eval({ a: 10, b: 20 })).toEqual({ total: 30 });
    });

    it('returns first result for multi-result expressions (scalar semantics)', () => {
      const compiled = engine.compile('.items[]');
      expect(compiled.eval({ items: [1, 2, 3] })).toBe(1);
    });
  });

  describe('validate', () => {
    it('does not throw for valid syntax', () => {
      expect(() => engine.validate('.name')).not.toThrow();
    });

    it('throws for invalid syntax', () => {
      expect(() => engine.validate('.[')).toThrow();
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/jq-expression-engine.test.ts`
Expected: FAIL — `JqExpressionEngine` not found

- [ ] **Step 4: Implement JqExpressionEngine**

```typescript
// jq-expression-engine.ts
import { compile as jqCompile } from '@sscots/jqjs';
import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';

export class JqExpressionEngine implements ExpressionEngine {
  readonly type = 'jq';

  compile(expression: string): CompiledExpression {
    const compiled = jqCompile(expression);
    return {
      type: 'jq',
      eval(context: Record<string, unknown>) {
        const gen = compiled(context);
        return gen.next().value ?? null;
      },
    };
  }

  validate(expression: string): void {
    jqCompile(expression);
  }
}
```

**Note:** Verify the `@sscots/jqjs` API shape — the `compile()` import name and generator pattern. If the API differs (e.g., default export, different function name), adapt the import. The key contract: `compile(expression)` returns a function that, when called with input data, returns an iterable/generator of results.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/jq-expression-engine.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/yaml-core/src/expression/ packages/yaml-core/package.json yarn.lock
git commit -m "feat(#641): JqExpressionEngine wrapping @sscots/jqjs

Pure JS JQ engine — compile() → generator, eval() takes first result
(scalar semantics matching Java's JQExpressionEngine for Object.class).
Covers: field access, arithmetic, pipes, filters, object construction.

Refs #641"
```

### Task 4: JsExpressionEngine

**Files:**
- Create: `packages/yaml-core/src/expression/js-expression-engine.ts`
- Test: `packages/yaml-core/src/expression/js-expression-engine.test.ts`

**Interfaces:**
- Consumes: `ExpressionEngine`, `CompiledExpression` from Task 1
- Produces: `JsExpressionEngine` class (type = `'js'`)

- [ ] **Step 1: Write failing tests**

```typescript
// js-expression-engine.test.ts
import { describe, it, expect } from 'vitest';
import { JsExpressionEngine } from './js-expression-engine.js';

describe('JsExpressionEngine', () => {
  const engine = new JsExpressionEngine();

  it('has type js', () => {
    expect(engine.type).toBe('js');
  });

  describe('compile + eval', () => {
    it('evaluates arithmetic expression', () => {
      const compiled = engine.compile('a + b');
      expect(compiled.eval({ a: 3, b: 4 })).toBe(7);
    });

    it('evaluates boolean condition', () => {
      const compiled = engine.compile('count > 0');
      expect(compiled.eval({ count: 5 })).toBe(true);
      expect(compiled.eval({ count: 0 })).toBe(false);
    });

    it('evaluates string concatenation', () => {
      const compiled = engine.compile("firstName + ' ' + lastName");
      expect(compiled.eval({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
    });

    it('evaluates ternary', () => {
      const compiled = engine.compile("status === 'active' ? 'yes' : 'no'");
      expect(compiled.eval({ status: 'active' })).toBe('yes');
      expect(compiled.eval({ status: 'inactive' })).toBe('no');
    });

    it('uses null-prototype context to prevent prototype leakage', () => {
      const compiled = engine.compile('typeof constructor');
      expect(compiled.eval({})).toBe('undefined');
    });

    it('provides access to context properties without ctx prefix', () => {
      const compiled = engine.compile('itemCount');
      expect(compiled.eval({ itemCount: 42 })).toBe(42);
    });
  });

  describe('validate', () => {
    it('does not throw for valid syntax', () => {
      expect(() => engine.validate('x > 0')).not.toThrow();
    });

    it('throws for invalid syntax', () => {
      expect(() => engine.validate('if {')).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/js-expression-engine.test.ts`
Expected: FAIL — `JsExpressionEngine` not found

- [ ] **Step 3: Implement JsExpressionEngine**

```typescript
// js-expression-engine.ts
import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';

export class JsExpressionEngine implements ExpressionEngine {
  readonly type = 'js';

  compile(expression: string): CompiledExpression {
    const fn = new Function('ctx', `with(ctx) { return (${expression}); }`);
    return {
      type: 'js',
      eval(context: Record<string, unknown>) {
        const safeCtx = Object.create(null);
        Object.assign(safeCtx, context);
        return fn(safeCtx);
      },
    };
  }

  validate(expression: string): void {
    new Function('ctx', `with(ctx) { return (${expression}); }`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/js-expression-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/yaml-core/src/expression/
git commit -m "feat(#641): JsExpressionEngine — native JS expression evaluation

Uses new Function with null-prototype context to prevent prototype chain
leakage. Covers MVEL/JEXL use cases in browser: boolean conditions,
arithmetic, string operations, ternary.

Refs #641"
```

## Batch 3: VariableResolver Dual-Registration + ParameterType.EXPRESSION

### Task 5: VariableResolver dual-registration

**Files:**
- Modify: `packages/yaml-core/src/variable-resolver.ts` — add `scopeContainers`, `withExpressionContext()`, `withObjectScope()` map overload, `buildExpressionContext()`
- Test: `packages/yaml-core/src/expression/variable-resolver-expression.test.ts`

**Interfaces:**
- Consumes: Existing `VariableResolver` class (immutable, copy-on-write pattern)
- Produces: `VariableResolver.withExpressionContext(prefix: string, container: Record<string, unknown>): VariableResolver`, `VariableResolver.buildExpressionContext(): Record<string, unknown>`

- [ ] **Step 1: Write failing tests**

```typescript
// variable-resolver-expression.test.ts
import { describe, it, expect } from 'vitest';
import { VariableResolver } from '../variable-resolver.js';

describe('VariableResolver expression context', () => {
  it('withExpressionContext returns a new resolver (immutable)', () => {
    const r1 = new VariableResolver({}, {});
    const r2 = r1.withExpressionContext('env', { host: 'localhost' });
    expect(r2).not.toBe(r1);
  });

  it('buildExpressionContext returns empty when no containers', () => {
    const resolver = new VariableResolver({}, {});
    expect(resolver.buildExpressionContext()).toEqual({});
  });

  it('buildExpressionContext aggregates containers by prefix', () => {
    const resolver = new VariableResolver({}, {})
      .withExpressionContext('env', { host: 'localhost', port: 8080 })
      .withExpressionContext('user', { name: 'Alice' });

    expect(resolver.buildExpressionContext()).toEqual({
      env: { host: 'localhost', port: 8080 },
      user: { name: 'Alice' },
    });
  });

  it('withExpressionContext does not affect string interpolation', () => {
    const resolver = new VariableResolver({}, {})
      .withExpressionContext('env', { host: 'localhost' });

    expect(() => resolver.resolveString('${env.host}', 'test'))
      .toThrow();
  });

  it('withObjectScope with Record adds to both interpolation and expression context', () => {
    const data = { host: 'localhost', port: 8080 };
    const resolver = new VariableResolver({}, {})
      .withObjectScope('env', data);

    // Available for interpolation
    expect(resolver.resolveString('${env.host}', 'test')).toBe('localhost');
    // Available for expression context
    expect(resolver.buildExpressionContext()).toEqual({ env: data });
  });

  it('chaining withExpressionContext preserves earlier containers', () => {
    const r = new VariableResolver({}, {})
      .withExpressionContext('a', { x: 1 })
      .withExpressionContext('b', { y: 2 });

    const ctx = r.buildExpressionContext();
    expect(ctx).toEqual({ a: { x: 1 }, b: { y: 2 } });
  });

  it('existing withScope does not add to expression context', () => {
    const resolver = new VariableResolver({}, {})
      .withScope('vars', (_key) => 'value');
    expect(resolver.buildExpressionContext()).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/variable-resolver-expression.test.ts`
Expected: FAIL — `withExpressionContext` / `buildExpressionContext` not found

- [ ] **Step 3: Add scopeContainers field and methods to VariableResolver**

Modify `packages/yaml-core/src/variable-resolver.ts`:

1. Add `private scopeContainers: Record<string, Record<string, unknown>>` field (line 10, after `deferredPrefixHandler`)
2. Accept `scopeContainers` in constructor (add parameter, default `{}`)
3. Pass `scopeContainers` in all copy-on-write returns (`withScope`, `withObjectScope`, `withChainedScope`, `withDeferredPrefixHandler`)
4. Add `withExpressionContext(prefix, container)` method — returns new VariableResolver with container added to `scopeContainers`
5. Add `buildExpressionContext()` method — returns `{ ...scopeContainers }`
6. Modify `withObjectScope` to detect `Record<string, unknown>` vs `ObjectVariableSource`: when called with a plain record (no `resolve` method), wrap it as an `ObjectVariableSource` AND add to `scopeContainers` (dual-registration)

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/variable-resolver-expression.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing VariableResolver tests to verify no regressions**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/variable-resolver.test.ts`
Expected: PASS — all existing tests unchanged

- [ ] **Step 6: Commit**

```bash
git add packages/yaml-core/src/variable-resolver.ts packages/yaml-core/src/expression/
git commit -m "feat(#641): VariableResolver dual-registration — scopeContainers + expression context

Add withExpressionContext(prefix, map) for expression-only context.
Add buildExpressionContext() to aggregate all scope containers.
withObjectScope(prefix, Record) dual-registers for interpolation + expression.
Immutable copy-on-write pattern preserved.

Refs #641"
```

### Task 6: ParameterType.EXPRESSION + barrel exports

**Files:**
- Modify: `packages/yaml-core/src/types.ts:1` — add `'EXPRESSION'` to ParameterType union
- Modify: `packages/yaml-core/src/types.ts:49-56` — update `parseParameterType()`
- Modify: `packages/yaml-core/src/types.ts:58-67` — update `validateParamValue()`
- Modify: `packages/yaml-core/src/types.ts:38-43` — update `canAcceptType()`
- Create: `packages/yaml-core/src/expression/index.ts` — barrel export
- Modify: `packages/yaml-core/src/index.ts` — add expression exports
- Test: `packages/yaml-core/src/expression/parameter-type-expression.test.ts`

**Interfaces:**
- Consumes: Existing `ParameterType`, `parseParameterType()`, `validateParamValue()`, `canAcceptType()` from `types.ts`
- Produces: `ParameterType` with `'EXPRESSION'` added; expression module exports

- [ ] **Step 1: Write failing tests**

```typescript
// parameter-type-expression.test.ts
import { describe, it, expect } from 'vitest';
import { parseParameterType, validateParamValue, canAcceptType } from '../types.js';

describe('ParameterType EXPRESSION', () => {
  it('parseParameterType recognizes EXPRESSION', () => {
    expect(parseParameterType('EXPRESSION')).toBe('EXPRESSION');
  });

  it('validateParamValue accepts string for EXPRESSION', () => {
    expect(validateParamValue('EXPRESSION', '.items | length')).toBe(true);
  });

  it('canAcceptType allows EXPRESSION to accept STRING', () => {
    expect(canAcceptType('EXPRESSION', 'STRING')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/parameter-type-expression.test.ts`
Expected: FAIL — `parseParameterType('EXPRESSION')` returns undefined or throws

- [ ] **Step 3: Add EXPRESSION to ParameterType and update functions**

In `packages/yaml-core/src/types.ts`:

Line 1 — add `'EXPRESSION'`:
```typescript
export type ParameterType = 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT' | 'EXPRESSION';
```

In `parseParameterType()` — add case for `'EXPRESSION'`.

In `validateParamValue()` — EXPRESSION accepts strings (the expression text):
```typescript
case 'EXPRESSION': return typeof value === 'string';
```

In `canAcceptType()` — EXPRESSION can accept STRING source values:
```typescript
if (target === 'EXPRESSION') return source === 'STRING';
```

- [ ] **Step 4: Create barrel export**

```typescript
// packages/yaml-core/src/expression/index.ts
export type { ExpressionContext } from './expression-context.js';
export type { CompiledExpression, ExpressionDescription } from './compiled-expression.js';
export { DescriptiveExpression } from './compiled-expression.js';
export type { ExpressionEngine } from './expression-engine.js';
export type { ExpressionEngineRegistry } from './expression-engine-registry.js';
export { DefaultExpressionEngineRegistry } from './expression-engine-registry.js';
export { JqExpressionEngine } from './jq-expression-engine.js';
export { JsExpressionEngine } from './js-expression-engine.js';
```

- [ ] **Step 5: Add expression exports to yaml-core index.ts**

Append to `packages/yaml-core/src/index.ts`:

```typescript
export {
  DescriptiveExpression,
  DefaultExpressionEngineRegistry,
  JqExpressionEngine,
  JsExpressionEngine,
} from './expression/index.js';
export type {
  ExpressionEngine,
  ExpressionEngineRegistry,
  CompiledExpression,
  ExpressionDescription,
  ExpressionContext,
} from './expression/index.js';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/parameter-type-expression.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/yaml-core/src/types.ts packages/yaml-core/src/expression/ packages/yaml-core/src/index.ts
git commit -m "feat(#641): ParameterType.EXPRESSION + expression module barrel exports

Add EXPRESSION as 7th ParameterType value. Update parseParameterType,
validateParamValue, canAcceptType. Create expression/index.ts barrel
and add all expression exports to yaml-core index.

Refs #641"
```

## Batch 4: StructuralEvaluator Integration

### Task 7: Type-aware param resolution in evaluatePlugin()

**Files:**
- Modify: `packages/yaml-core/src/step/structural-evaluator.ts:68-72` — type-aware routing in `evaluatePlugin()`
- Test: `packages/yaml-core/src/expression/structural-evaluator-expression.test.ts`

**Interfaces:**
- Consumes: `PluginStep` (has `entry.definition.inputs: Record<string, Parameter>`), `Context` (has `resolver`, `services`), `ExpressionEngineRegistry`, `VariableResolver.buildExpressionContext()`
- Produces: `resolvePluginParams()` function, `resolveExpression()` function, `hasExpressionParams()` function — all in `structural-evaluator.ts` or a new `expression-resolver.ts`

- [ ] **Step 1: Create expression-resolver utility**

Create `packages/yaml-core/src/step/expression-resolver.ts` with the resolution logic:

```typescript
import type { ExpressionEngineRegistry } from '../expression/expression-engine-registry.js';
import type { VariableResolver } from '../variable-resolver.js';
import type { Parameter } from './types.js';

export function hasExpressionParams(inputs: Record<string, Parameter> | undefined): boolean {
  if (!inputs) return false;
  return Object.values(inputs).some(p => p.type === 'EXPRESSION');
}

export function resolvePluginParams(
  rawParams: Record<string, unknown>,
  declaredInputs: Record<string, Parameter>,
  resolver: VariableResolver,
  registry: ExpressionEngineRegistry,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  const stringParams: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawParams)) {
    const declared = declaredInputs[key];
    if (declared?.type === 'EXPRESSION') {
      resolved[key] = resolveExpression(value, resolver, registry);
    } else {
      stringParams[key] = value;
    }
  }

  Object.assign(resolved, resolver.resolveMap(stringParams, 'step'));
  return resolved;
}

function resolveExpression(
  rawValue: unknown,
  resolver: VariableResolver,
  registry: ExpressionEngineRegistry,
): unknown {
  if (rawValue == null) return null;
  if (typeof rawValue !== 'string') return rawValue;

  let expr = rawValue;
  if (expr.startsWith('${') && expr.endsWith('}')
      && expr.indexOf('}') === expr.length - 1) {
    expr = expr.substring(2, expr.length - 1);
  }

  const engineType = registry.resolveDefault('PARAMETER');
  if (!engineType) {
    throw new Error('No default expression engine registered for PARAMETER');
  }

  const context = resolver.buildExpressionContext();
  const compiled = registry.compile(engineType, expr);
  return compiled.eval(context);
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// structural-evaluator-expression.test.ts
import { describe, it, expect } from 'vitest';
import {
  hasExpressionParams,
  resolvePluginParams,
} from '../step/expression-resolver.js';
import { DefaultExpressionEngineRegistry } from '../expression/expression-engine-registry.js';
import { JsExpressionEngine } from '../expression/js-expression-engine.js';
import { VariableResolver } from '../variable-resolver.js';
import type { Parameter } from '../step/types.js';

function makeRegistry(): DefaultExpressionEngineRegistry {
  const registry = new DefaultExpressionEngineRegistry();
  registry.register(new JsExpressionEngine());
  registry.registerDefault('PARAMETER', 'js');
  return registry;
}

describe('hasExpressionParams', () => {
  it('returns false for undefined inputs', () => {
    expect(hasExpressionParams(undefined)).toBe(false);
  });

  it('returns false when no EXPRESSION params', () => {
    const inputs: Record<string, Parameter> = {
      name: { type: 'STRING', required: true },
    };
    expect(hasExpressionParams(inputs)).toBe(false);
  });

  it('returns true when EXPRESSION param exists', () => {
    const inputs: Record<string, Parameter> = {
      name: { type: 'STRING', required: true },
      filter: { type: 'EXPRESSION', required: true },
    };
    expect(hasExpressionParams(inputs)).toBe(true);
  });
});

describe('resolvePluginParams', () => {
  it('routes EXPRESSION params through engine, STRING through resolver', () => {
    const registry = makeRegistry();
    const resolver = new VariableResolver(
      { vars: (_k: string) => 'hello' },
      {},
    ).withExpressionContext('data', { count: 5 });

    const inputs: Record<string, Parameter> = {
      greeting: { type: 'STRING', required: true },
      active: { type: 'EXPRESSION', required: true },
    };

    const result = resolvePluginParams(
      { greeting: '${vars.msg}', active: 'data.count > 0' },
      inputs,
      resolver,
      registry,
    );

    expect(result.active).toBe(true);
  });

  it('strips ${} wrapper from EXPRESSION values', () => {
    const registry = makeRegistry();
    const resolver = new VariableResolver({}, {})
      .withExpressionContext('data', { x: 10 });

    const inputs: Record<string, Parameter> = {
      value: { type: 'EXPRESSION', required: true },
    };

    const result = resolvePluginParams(
      { value: '${x + 1}' },
      inputs,
      resolver,
      registry,
    );

    expect(result.value).toBe(11);
  });

  it('passes null through for EXPRESSION params', () => {
    const registry = makeRegistry();
    const resolver = new VariableResolver({}, {});
    const inputs: Record<string, Parameter> = {
      opt: { type: 'EXPRESSION', required: false },
    };

    const result = resolvePluginParams(
      { opt: null },
      inputs,
      resolver,
      registry,
    );

    expect(result.opt).toBeNull();
  });

  it('passes non-string values through for EXPRESSION params', () => {
    const registry = makeRegistry();
    const resolver = new VariableResolver({}, {});
    const inputs: Record<string, Parameter> = {
      count: { type: 'EXPRESSION', required: true },
    };

    const result = resolvePluginParams(
      { count: 42 },
      inputs,
      resolver,
      registry,
    );

    expect(result.count).toBe(42);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/structural-evaluator-expression.test.ts`
Expected: FAIL — `expression-resolver` not found

- [ ] **Step 4: Run tests after creating expression-resolver.ts**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/structural-evaluator-expression.test.ts`
Expected: PASS

- [ ] **Step 5: Wire evaluatePlugin() to use expression resolver**

Modify `packages/yaml-core/src/step/structural-evaluator.ts:68-72`:

Add import at top:
```typescript
import { hasExpressionParams, resolvePluginParams } from './expression-resolver.js';
import type { ExpressionEngineRegistry } from '../expression/expression-engine-registry.js';
```

Replace `evaluatePlugin()`:
```typescript
private async evaluatePlugin(step: PluginStep, context: Context): Promise<Result> {
  let resolvedParams: Record<string, unknown>;
  const declaredInputs = step.entry.definition?.inputs;
  if (declaredInputs && hasExpressionParams(declaredInputs)) {
    const registry = context.services.lookup({ name: 'ExpressionEngineRegistry' }) as ExpressionEngineRegistry;
    resolvedParams = resolvePluginParams(step.params, declaredInputs, context.resolver, registry);
  } else {
    resolvedParams = context.resolver.resolveMap(step.params, step.name ?? 'anonymous');
  }
  const chain = DecoratorChain.build(step.decorators, step.entry.action);
  return chain.execute({ ...context, params: resolvedParams, stepName: step.name ?? 'anonymous' });
}
```

- [ ] **Step 6: Run all yaml-core tests**

Run: `yarn workspace @casehubio/yaml-core run test -- --run`
Expected: PASS — all existing + new tests

- [ ] **Step 7: Commit**

```bash
git add packages/yaml-core/src/step/expression-resolver.ts packages/yaml-core/src/step/structural-evaluator.ts packages/yaml-core/src/expression/
git commit -m "feat(#641): type-aware param resolution in evaluatePlugin()

Route EXPRESSION-typed params through ExpressionEngineRegistry instead
of VariableResolver string interpolation. Add resolvePluginParams() with
null passthrough, non-string passthrough, and \$\{\} stripping. Fast path
skips expression logic when no EXPRESSION params declared.

Refs #641"
```

## Batch 5: Factory + Integration Test

### Task 8: createExpressionEngineRegistry factory + .test.yaml integration

**Files:**
- Create: `packages/yaml-core/src/expression/create-registry.ts`
- Modify: `packages/yaml-core/src/expression/index.ts` — export factory
- Modify: `packages/yaml-core/src/index.ts` — export factory
- Test: `packages/yaml-core/src/expression/create-registry.test.ts`

**Interfaces:**
- Consumes: `DefaultExpressionEngineRegistry`, `JqExpressionEngine`, `JsExpressionEngine`, `ExpressionContext`
- Produces: `createExpressionEngineRegistry(): ExpressionEngineRegistry`

- [ ] **Step 1: Write failing test**

```typescript
// create-registry.test.ts
import { describe, it, expect } from 'vitest';
import { createExpressionEngineRegistry } from './create-registry.js';

describe('createExpressionEngineRegistry', () => {
  it('registers JQ and JS engines', () => {
    const registry = createExpressionEngineRegistry();
    expect(registry.resolve('jq')).toBeDefined();
    expect(registry.resolve('js')).toBeDefined();
  });

  it('maps all ExpressionContext values to defaults', () => {
    const registry = createExpressionEngineRegistry();
    expect(registry.resolveDefault('CONDITION')).toBe('js');
    expect(registry.resolveDefault('TRANSFORM')).toBe('jq');
    expect(registry.resolveDefault('FILTER')).toBe('jq');
    expect(registry.resolveDefault('PARAMETER')).toBe('js');
  });

  it('compiles and evaluates via JQ default for TRANSFORM', () => {
    const registry = createExpressionEngineRegistry();
    const engineType = registry.resolveDefault('TRANSFORM')!;
    const compiled = registry.compile(engineType, '.items | length');
    expect(compiled.eval({ items: [1, 2, 3] })).toBe(3);
  });

  it('compiles and evaluates via JS default for CONDITION', () => {
    const registry = createExpressionEngineRegistry();
    const engineType = registry.resolveDefault('CONDITION')!;
    const compiled = registry.compile(engineType, 'count > 0');
    expect(compiled.eval({ count: 5 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/create-registry.test.ts`
Expected: FAIL — `createExpressionEngineRegistry` not found

- [ ] **Step 3: Implement factory**

```typescript
// create-registry.ts
import { DefaultExpressionEngineRegistry } from './expression-engine-registry.js';
import { JqExpressionEngine } from './jq-expression-engine.js';
import { JsExpressionEngine } from './js-expression-engine.js';
import type { ExpressionContext } from './expression-context.js';
import type { ExpressionEngineRegistry } from './expression-engine-registry.js';

export function createExpressionEngineRegistry(): ExpressionEngineRegistry {
  const registry = new DefaultExpressionEngineRegistry();
  registry.register(new JqExpressionEngine());
  registry.register(new JsExpressionEngine());

  registry.registerDefault('CONDITION', 'js');
  registry.registerDefault('TRANSFORM', 'jq');
  registry.registerDefault('FILTER', 'jq');
  registry.registerDefault('PARAMETER', 'js');

  const contexts: ExpressionContext[] = ['CONDITION', 'TRANSFORM', 'FILTER', 'PARAMETER'];
  for (const ctx of contexts) {
    if (!registry.resolveDefault(ctx)) {
      throw new Error(`No default expression engine registered for ${ctx}`);
    }
  }
  return registry;
}
```

- [ ] **Step 4: Add to barrel exports**

Add to `packages/yaml-core/src/expression/index.ts`:
```typescript
export { createExpressionEngineRegistry } from './create-registry.js';
```

Add to `packages/yaml-core/src/index.ts`:
```typescript
export { createExpressionEngineRegistry } from './expression/index.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn workspace @casehubio/yaml-core run test -- --run src/expression/create-registry.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `yarn workspace @casehubio/yaml-core run test -- --run`
Expected: PASS — all tests green

- [ ] **Step 7: Commit**

```bash
git add packages/yaml-core/src/expression/ packages/yaml-core/src/index.ts
git commit -m "feat(#641): createExpressionEngineRegistry factory with default engine mappings

Factory registers JQ + JS engines and maps all 4 ExpressionContext
values to defaults (CONDITION→js, TRANSFORM→jq, FILTER→jq, PARAMETER→js).
Validates all contexts have a default at creation time.

Refs #641"
```

---

## References

- [2026-11-08-expression-system-design.md] — design spec this plan implements
- [packages/yaml-core/src/variable-resolver.ts] — VariableResolver (immutable, copy-on-write)
- [packages/yaml-core/src/types.ts:1] — ParameterType union (6 current values)
- [packages/yaml-core/src/step/structural-evaluator.ts:68-72] — evaluatePlugin choke point
- [packages/yaml-core/src/step/walker.ts:89-96] — PluginStep interface (entry.definition.inputs)
- [packages/yaml-core/src/step/types.ts:4-11] — Parameter interface (type: ParameterType)
- [packages/yaml-core/src/step/decorator-chain.ts:18-25] — Context interface (services, resolver)
- [packages/yaml-core/src/index.ts] — yaml-core barrel export
- [npm @sscots/jqjs] — pure JS JQ implementation
- [GitHub #641] — Phase 3: expression system
- [GitHub #608] — parent: TS/Java YAML runtime parity
