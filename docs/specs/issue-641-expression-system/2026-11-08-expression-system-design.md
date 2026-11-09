# Design Spec — #641 Expression System (Type-Aware Resolution)

**Issue:** casehubio/casehub-pages#641
**Parent:** casehubio/casehub-pages#608 (TS/Java YAML runtime parity)
**Scope:** TS expression pipeline — engine infrastructure, ParameterType.EXPRESSION routing, VariableResolver dual-registration, concrete engines (JQ + JS). Java integration is already complete.

## 1. Problem

The TS YAML runtime resolves all plugin parameters via string interpolation (`${prefix.name}`). There is no way to declare a parameter as an expression that should be compiled and evaluated by a pluggable engine (JQ, JS). Java already has the full expression pipeline — engine infrastructure (interfaces, registry, 3 engine implementations in expression-core), `ParameterType.EXPRESSION` (7th enum value in yaml-plugin-api), `VariableResolver` dual-registration (scopeContainers, withExpressionContext, buildExpressionContext), and `TypeAwareParamResolver` routing EXPRESSION params through `ExpressionEngineRegistry`. TS has none of this.

## 2. Architecture

### 2.1 Resolution Pipeline (After)

```
YAML param value → ParameterType check
  ├── STRING/INTEGER/NUMBER/BOOLEAN/ARRAY/OBJECT
  │     → VariableResolver.resolve() → ${} string interpolation (unchanged)
  └── EXPRESSION
        → VariableResolver.buildExpressionContext()
        → ExpressionEngineRegistry.compile(engineType, expression)
        → CompiledExpression.eval(context)
        → typed result
```

The expression path is parallel to interpolation, not a replacement. A plugin param is either interpolated or evaluated — never both. The plugin schema decides which path via `ParameterType`.

### 2.2 New Types

All types live in yaml-core on both TS and Java sides.

#### ExpressionEngine

```typescript
// TS (yaml-core/src/expression/expression-engine.ts)
interface ExpressionEngine {
  readonly type: string;                    // discriminator: "jq", "js"
  compile(expression: string): CompiledExpression;
  validate(expression: string): void;       // throws on invalid syntax
}
```

One engine per language. Stateless — all state lives in the compiled expression.

**Type-safety divergence from Java (intentional):** Java's `ExpressionEngine` is fully generic — `<C, R> CompiledExpression<C, R> compile(String expression, Class<C> contextType, Class<R> resultType)` — because JVM has runtime type reification. MVEL uses `contextType` to verify bean property names at compile time; JQ uses `resultType` to cast the Jackson `JsonNode` result. TypeScript has no equivalent to `Class<C>` at runtime — type parameters are erased at compilation. The TS interface simplifies to `compile(expression: string)` with a fixed context type of `Record<string, unknown>`. The `variables` overload is similarly omitted since TS engines don't need compile-time variable binding.

**validate() matches Java:** `void validate(String expression)` — throws on invalid syntax with a descriptive error message. Callers who need the error message get it from the thrown error. This avoids a boolean API that swallows diagnostics.

**supportsStringCreation() omitted:** Java's `default boolean supportsStringCreation() { return true; }` is not ported to TS. This method is used by Java callers to determine whether an engine's output can be coerced to a string for interpolation contexts. In TS, expression evaluation is always distinct from string interpolation (parallel paths, §2.1), so the coercion question doesn't arise.

#### CompiledExpression

```typescript
// TS
interface CompiledExpression<R = unknown> {
  readonly type: string;                    // engine type that produced this
  eval(context: Record<string, unknown>): R;
}
```

Minimal contract. The engine compiles the expression string into this object. `eval()` receives the aggregated expression context from VariableResolver and returns a typed result.

#### ExpressionContext (enum)

```typescript
// TS
type ExpressionContext = 'CONDITION' | 'TRANSFORM' | 'FILTER' | 'PARAMETER';
```

Mirrors Java's `ExpressionContext` enum in platform-api (4 values). Maps execution contexts to default engine types. `PARAMETER` is the context used by the type-aware param resolver to look up the default engine for EXPRESSION-typed parameters — `resolveDefault(ExpressionContext.PARAMETER)`. Without it, there is no default engine for the primary use case of this spec.

#### ExpressionEngineRegistry

```typescript
// TS
interface ExpressionEngineRegistry {
  register(engine: ExpressionEngine): void;
  resolve(type: string): ExpressionEngine | undefined;
  compile(type: string, expression: string): CompiledExpression;
  registerDefault(context: ExpressionContext, engineType: string): void;
  resolveDefault(context: ExpressionContext): string | undefined;
  clearCache(): void;
}
```

Central dispatcher. `compile()` delegates to the registered engine for the given type. If no engine is registered for the type, returns a `DescriptiveExpression` (see §2.5).

**Default engine mappings (TS):**

| ExpressionContext | TS default | Java default | Rationale |
|---|---|---|---|
| CONDITION | `'js'` | `'mvel'` | JS covers MVEL's boolean expression use cases in the browser |
| TRANSFORM | `'jq'` | `'jq'` | Same engine — data transformation |
| FILTER | `'jq'` | `'jq'` | Same engine — data filtering |
| PARAMETER | `'js'` | `'mvel'` | JS covers MVEL's inline expression use cases in the browser |

**Initialization:** The `DefaultExpressionEngineRegistry` factory function registers engines and defaults, then validates that every `ExpressionContext` value has a default:

```typescript
function createExpressionEngineRegistry(): ExpressionEngineRegistry {
  const registry = new DefaultExpressionEngineRegistry();
  registry.register(new JqExpressionEngine());
  registry.register(new JsExpressionEngine());

  registry.registerDefault('CONDITION',  'js');
  registry.registerDefault('TRANSFORM',  'jq');
  registry.registerDefault('FILTER',     'jq');
  registry.registerDefault('PARAMETER',  'js');

  const contexts: ExpressionContext[] = ['CONDITION', 'TRANSFORM', 'FILTER', 'PARAMETER'];
  for (const ctx of contexts) {
    if (!registry.resolveDefault(ctx)) {
      throw new Error(`No default expression engine registered for ${ctx}`);
    }
  }
  return registry;
}
```

This mirrors Java's `ExpressionBeans` (Quarkus) and `ExpressionSpringAutoConfiguration` (Spring), which both register all four defaults and validate with a loop over `ExpressionContext.values()`. The factory is called during TS application bootstrap and the result is registered in `ServiceRegistry`.

#### ParameterType.EXPRESSION

```typescript
// TS — yaml-core/src/types.ts
type ParameterType = 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT' | 'EXPRESSION';
```

Java `yaml-plugin-api` already has `EXPRESSION` as the 7th ParameterType value. TS adds it to match.

Plugin param schemas declare `type: EXPRESSION` to opt into expression evaluation. The YAML author writes the expression value directly — no special syntax prefix.

The engine type for an EXPRESSION param is determined by:
1. `ExpressionContext.PARAMETER` default — `registry.resolveDefault('PARAMETER')` returns the engine type registered for parameter expression evaluation
2. If no default registered, the TS registry returns a `DescriptiveExpression` (§2.5); Java throws `IllegalStateException`

This matches Java's `TypeAwareParamResolver` which calls `engines.resolveDefault(ExpressionContext.PARAMETER)` and throws if no default is registered.

### 2.3 VariableResolver Dual-Registration

TS VariableResolver gains a `scopeContainers` map (paralleling Java) and two new methods:

```typescript
// TS additions to VariableResolver
class VariableResolver {
  private readonly scopeContainers: Record<string, Record<string, unknown>>;

  // existing — function-based object scope (no dual-registration)
  withObjectScope(prefix: string, source: ObjectVariableSource): VariableResolver;

  // new — Map-based overload with dual-registration (matches Java)
  withObjectScope(prefix: string, map: Record<string, unknown>): VariableResolver;

  // new — expression context only (no interpolation registration)
  withExpressionContext(prefix: string, container: Record<string, unknown>): VariableResolver;

  // new — aggregates all scope containers into expression context
  buildExpressionContext(): Record<string, unknown>;
}
```

**Dual-registration (matching Java):** Java's `withObjectScope(String, Map)` registers the map in both `objectPrefixSources` (wrapping as `map::get` for `${prefix.name}` interpolation) and `scopeContainers` (for `buildExpressionContext()`). The TS Map overload mirrors this — when a `Record<string, unknown>` is passed instead of an `ObjectVariableSource`, the resolver:
1. Wraps it as an `ObjectVariableSource` for variable interpolation
2. Adds it to `scopeContainers` for expression context

This ensures scopes pushed via `withObjectScope(prefix, map)` are automatically available for both `${prefix.name}` interpolation and expression evaluation. Callers don't need to call both methods separately.

- `withExpressionContext(prefix, container)` — adds to `scopeContainers` only, without creating a variable source (matches Java's method)
- `buildExpressionContext()` — aggregates all scope containers into a flat context map: `{prefix1: container1, prefix2: container2, ...}`, excluding deferred prefixes

### 2.4 Evaluation Choke Point

**TS — StructuralEvaluator.evaluatePlugin():**

Currently at the single choke point (line ~69):
```typescript
const resolvedParams = context.resolver.resolveMap(step.params, step.name ?? 'anonymous');
```

After this change, the choke point becomes type-aware:
```typescript
const declaredInputs = step.entry.definition.inputs;  // Record<string, Parameter>
if (hasExpressionParams(declaredInputs)) {
  const registry = context.services.lookup({ name: 'ExpressionEngineRegistry' });
  const resolvedParams = resolvePluginParams(
    step.params,
    declaredInputs,
    context.resolver,
    registry
  );
} else {
  const resolvedParams = context.resolver.resolveMap(step.params, step.name ?? 'anonymous');
}
```

Parameter type information comes from `step.entry.definition.inputs` — the plugin schema's declared inputs where each `Parameter` has a `type: ParameterType`. This is exactly how Java does it: `CatalogStepRunner` resolves the definition from the registry and passes `definition.inputs()` to `TypeAwareParamResolver.resolve()`.

The `ExpressionEngineRegistry` is accessed via `ServiceRegistry.lookup()`, matching Java's approach where `TypeAwareParamResolver` calls `services.lookup(ExpressionEngineRegistry.class)`. No new field is added to the `Context` interface.

`resolvePluginParams()` separates EXPRESSION params from the rest, then resolves each group through its own path:

```typescript
function resolvePluginParams(
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
  if (rawValue == null) return null;                      // null passthrough
  if (typeof rawValue !== 'string') return rawValue;      // non-string passthrough

  let expr = rawValue;
  if (expr.startsWith('${') && expr.endsWith('}')         // ${} stripping
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

Three guards from Java's `TypeAwareParamResolver.resolveExpression()`:
1. **Null passthrough** — an optional EXPRESSION param with no value returns null
2. **Non-string passthrough** — numeric or boolean values already resolved by the YAML parser pass through without expression evaluation
3. **`${}` stripping** — YAML authors write `${itemCount > 0}` in all param contexts. Without stripping, the expression engine receives `${itemCount > 0}` which is neither valid JQ nor valid JS. This bridges the existing `${}` convention with the new expression evaluation path.

**Java — already implemented.** `CatalogStepRunner` checks `hasExpressionParams(definition)` and delegates to `TypeAwareParamResolver` when EXPRESSION params are present.

### 2.5 Unsupported Engine Fallback (TS-specific)

**Divergence from Java:** Java's `DefaultExpressionEngineRegistry.resolveEngine()` throws `IllegalArgumentException` for unknown engine types. The `NoOpExpressionEngineRegistry` (platform-core) throws `UnsupportedOperationException`. There is no descriptive fallback in Java's expression system.

TS deliberately chooses a different behavior: when `ExpressionEngineRegistry.compile()` receives a type with no registered engine, it returns a `DescriptiveExpression`:

```typescript
interface ExpressionDescription {
  engine: string;
  expression: string;
  context: Record<string, unknown>;
  status: 'not-available';
}
```

```typescript
class DescriptiveExpression implements CompiledExpression<ExpressionDescription> {
  readonly type = 'descriptive';
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

**Rationale:** The TS runtime operates in the browser, where playbooks are previewed without all engines available. Throwing on an unregistered engine would crash the preview. Returning a structured description of what would have been evaluated allows the UI to show meaningful feedback — "this step would evaluate `jq:.items[] | select(.active)` but the JQ engine is not loaded." This is the same graceful degradation pattern used by the browser MCP runtime for unsupported step types.

### 2.6 Concrete Engines (TS)

#### JqExpressionEngine

Wraps `@sscots/jqjs` (pure JS, 76.7 kB, ISC license).

```typescript
class JqExpressionEngine implements ExpressionEngine {
  readonly type = 'jq';

  compile(expression: string): CompiledExpression {
    const compiled = jqCompile(expression);  // @sscots/jqjs compile()
    return {
      type: 'jq',
      eval(context) {
        const gen = compiled(context);
        return gen.next().value ?? null;      // first result (scalar semantics)
      },
    };
  }

  validate(expression: string): void {
    jqCompile(expression);  // throws on invalid syntax
  }
}
```

**First-result (scalar) semantics:** Java's `JQExpressionEngine` dispatches on `resultType`: `Boolean.class` → boolean-or, `List.class` → all results, everything else → `ScalarJQExpression` which takes only the first result. `TypeAwareParamResolver` calls `engines.compile(engineType, expr, Map.class, Object.class)` — `Object.class` routes to `ScalarJQExpression`, so the PARAMETER use case always takes the first result. The TS engine matches this behavior. Multi-result collection (Java's `List.class` path) is not exposed in the TS API — if needed, it can be added as a separate `compileList()` method on the engine.

Covers: object construction, arithmetic, pipes, filters, array operations. Does not support user-defined jq functions (acceptable for data transforms). Upgrade path: swap to `jq-web` (wasm) for full jq.

#### JsExpressionEngine

Native JS expression evaluation for simple conditions and transforms.

```typescript
class JsExpressionEngine implements ExpressionEngine {
  readonly type = 'js';

  compile(expression: string): CompiledExpression {
    const fn = new Function('ctx', `with(ctx) { return (${expression}); }`);
    return {
      type: 'js',
      eval(context) {
        const safeCtx = Object.create(null);
        Object.assign(safeCtx, context);
        return fn(safeCtx);
      },
    };
  }

  validate(expression: string): void {
    new Function('ctx', `with(ctx) { return (${expression}); }`);  // throws on parse error
  }
}
```

**Null-prototype context:** The `with(ctx)` statement resolves names against the prototype chain. With a plain object, expressions like `constructor`, `toString`, or `hasOwnProperty` would resolve to `Object.prototype` members instead of failing. Creating `ctx` via `Object.create(null)` eliminates the prototype chain, ensuring only explicitly provided context properties are resolvable.

Covers the MVEL/JEXL use cases in browser: simple expressions, boolean conditions, arithmetic, string operations. The `with(ctx)` pattern allows `itemCount > 0` instead of `ctx.itemCount > 0`.

**Security note:** `new Function` is acceptable here because expressions come from trusted YAML playbook definitions (authored by platform developers), not user input. If CSP restrictions block `new Function`, a sandboxed expression parser can replace the implementation without changing the interface.

#### Expression Caching

The `DefaultExpressionEngineRegistry` caches compiled expressions by `(engineType, expression)` key:

```typescript
class DefaultExpressionEngineRegistry implements ExpressionEngineRegistry {
  private readonly cache = new Map<string, CompiledExpression>();

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

  clearCache(): void {
    this.cache.clear();
  }
}
```

This avoids recompiling the same expression on every plugin step execution — relevant for playbook loops that execute the same step repeatedly. The JQ compile step parses the expression grammar; the JS compile step invokes `new Function`. Both are non-trivial and worth caching.

`clearCache()` allows consumers (e.g., page navigation that tears down the old page's expression state) to evict stale entries. This matches the `clearCache()` pattern on the existing JSONata bridge in pages-data. In a long-running browser session with dynamically constructed expressions, the cache would otherwise grow without bound.

#### Java Engines (no changes)

Java already has MvelExpressionEngine, JQExpressionEngine, JexlExpressionEngine in expression-core. No new engines needed.

## 3. Package Changes

### 3.1 New Work — TS yaml-core (this issue's deliverable)

New files:
- `src/expression/expression-engine.ts` — ExpressionEngine interface
- `src/expression/compiled-expression.ts` — CompiledExpression interface
- `src/expression/expression-context.ts` — ExpressionContext type
- `src/expression/expression-engine-registry.ts` — DefaultExpressionEngineRegistry + DescriptiveExpression
- `src/expression/jq-expression-engine.ts` — JqExpressionEngine
- `src/expression/js-expression-engine.ts` — JsExpressionEngine
- `src/expression/index.ts` — barrel export

Modified files:
- `src/types.ts` — add `'EXPRESSION'` to ParameterType, update `parseParameterType()`, update `validateParamValue()`, update `canAcceptType()`
- `src/variable-resolver.ts` — add `scopeContainers`, `withObjectScope(prefix, map)` overload, `withExpressionContext()`, `buildExpressionContext()`
- `src/step/structural-evaluator.ts` — type-aware param resolution in `evaluatePlugin()`

New dependency:
- `@sscots/jqjs` — JQ expression engine

### 3.2 Already Complete — Java (reference for parity, not implementation scope)

The following Java changes are already implemented. They are listed here as the parity reference for the TS implementation above — not as work to be done.

- **yaml-plugin-api** `ParameterType.java` — `EXPRESSION` is already the 7th enum value, with `validate()`, `parseScalar()`, `canAccept()`, and `fromString()` support
- **yaml-core** `VariableResolver.java` — `scopeContainers`, `withExpressionContext(String, Map)`, `buildExpressionContext()` already exist, including the dual-registration `withObjectScope(String, Map)` overload
- **yaml-step-runtime** `CatalogStepRunner.java` — already routes EXPRESSION-typed params through `TypeAwareParamResolver`, which uses `ExpressionEngineRegistry` via `ServiceRegistry`
- **platform-api** `ExpressionContext.java` — 4-value enum (CONDITION, TRANSFORM, FILTER, PARAMETER)
- **expression-core** — MvelExpressionEngine, JQExpressionEngine, JexlExpressionEngine, DefaultExpressionEngineRegistry

## 4. Testing Strategy

### 4.1 TS Unit Tests

- `expression-engine-registry.test.ts` — register/resolve engines, default context mapping, descriptive fallback for unknown types
- `jq-expression-engine.test.ts` — compile + eval for object construction, filters, pipes, arithmetic; validate syntax
- `js-expression-engine.test.ts` — compile + eval for conditions, arithmetic, string ops; validate syntax
- `variable-resolver-expression.test.ts` — withExpressionContext immutability, buildExpressionContext aggregation, interaction with existing prefixSources/objectSources
- `structural-evaluator-expression.test.ts` — EXPRESSION params routed through engine, non-EXPRESSION params unchanged, mixed param types in same plugin step

### 4.2 Java Unit Tests (already exist)

Java tests are already in place — listed for reference:
- `VariableResolverTest.java` — covers withExpressionContext, buildExpressionContext, immutability
- `ParameterTypeTest.java` — covers EXPRESSION parsing, validation
- `TypeAwareParamResolverTest.java` — covers EXPRESSION param routing through the registry
- `CatalogStepRunnerTest.java` — integration test for the full pipeline

### 4.3 Integration / .test.yaml

- YAML test file exercising a plugin step with EXPRESSION-typed params
- JQ expression evaluating against runtime context
- Unsupported engine producing descriptive output

## 5. Migration and Compatibility

- **No breaking changes.** EXPRESSION is additive — existing plugins with STRING/INTEGER/etc. params are unaffected.
- **No YAML syntax changes.** The YAML author writes expression values as strings. The plugin schema decides evaluation.
- **Backward compatible.** Existing VariableResolver API is unchanged — new methods are additions.
- **Incremental adoption.** Plugins opt in to EXPRESSION params individually. No big-bang migration.

## References

- `packages/yaml-core/src/variable-resolver.ts` — TS VariableResolver (immutable, functional)
- `packages/yaml-core/src/types.ts:1` — TS ParameterType (6 current values, EXPRESSION to be added)
- `packages/yaml-core/src/step/structural-evaluator.ts:68` — TS evaluation choke point
- `packages/yaml-core/src/step/walker.ts` — TS Walker, PluginStep, CatalogEntry, ServiceRegistry
- `packages/yaml-core/src/step/decorator-chain.ts:18` — TS Context interface
- `packages/pages-data/src/expression/jsonata-bridge.ts` — existing TS CompiledExpression (JSONata, different interface)
- Java `platform-api/.../ExpressionEngine.java` — existing engine interface (generic: `<C, R>`)
- Java `platform-api/.../ExpressionEngineRegistry.java` — existing registry
- Java `platform-api/.../CompiledExpression.java` — existing compiled expression (generic: `<C, R>`)
- Java `platform-api/.../ExpressionContext.java` — 4-value enum (CONDITION, TRANSFORM, FILTER, PARAMETER)
- Java `yaml-plugin-api/.../ParameterType.java` — 7-value enum (EXPRESSION already present)
- Java `yaml-core/.../resolver/VariableResolver.java` — Java VariableResolver (with scopeContainers, dual-registration)
- Java `yaml-step-runtime/.../TypeAwareParamResolver.java` — existing type-aware param resolution
- Java `yaml-step-runtime/.../CatalogStepRunner.java` — existing EXPRESSION routing
- `docs/specs/2026-11-07-ts-platform-parity-audit.md` — H2, H7 sections
- npm `@sscots/jqjs` — pure JS JQ implementation (76.7 kB, ISC)
- D1-D7 decisions in `specs/issue-641-expression-system/decisions.md`
