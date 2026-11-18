# Playbook Sync — Platform WS-3, WS-4, WS-5 and Recent Changes

**Issue:** #707 (parent: #669)
**Branch:** `issue-707-playbook-sync`
**Date:** 2026-11-18

## Summary

Port 5 platform playbook changes to the TS `yaml-core` package. Each
change is mechanical — the design decisions were made on the platform
side; this spec describes the TS-side delta.

## Scope

| # | Platform ref | Description | TS files affected |
|---|---|---|---|
| 1 | #830 (WS-3) | Trust model: capabilities, ASSISTED schema | `playbook-schema.ts`, `playbook.ts` |
| 2 | #833 (WS-4) | Canonical form: `forEach` → `for-each` | `types.ts`, `walker.ts`, `foreach-expander.ts`, tests |
| 3 | #726 | Scalar subjects for 3 step types | `definition-parser.ts` (or equivalent) |
| 4 | #834 (WS-5) | Test rules, headers, lint | Test infrastructure |
| 5 | #850 (WS-5b) | Category-level behavioral tests | Test files |

**Excluded:** #795 (@Plugin step types) — TS already has `PluginRegistry`
with manual registration; annotation scanning has no TS analogue.

## Work ordering

Schema-first bottom-up: 1 → 2 → 3 → 4 → 5. Additive trust model
changes first (low risk), riskiest parser changes in the middle,
test infrastructure last when runtime shape is final.

---

## 1. Trust Model (#830)

### Capabilities

Add 4 risk-bearing capabilities to `PLAYBOOK_CAPABILITIES` in
`playbook-schema.ts`:

```typescript
// Risk-bearing capabilities (excluded from assisted authoring context)
PROCESS_EXECUTION: 'process-execution',
RAW_HTTP: 'raw-http',
EXPRESSION_MVEL: 'expression-mvel',
ENV_ACCESS: 'env-access',
```

Remove `TRIGGERS: 'triggers'` — does not exist in platform.

### ASSISTED schema

Add a third built-in schema `assisted` in `createPlaybookSchemaRegistry()`.
Definition: server capabilities minus risk-bearing capabilities.

```typescript
schemas.set('assisted', builtIn('assisted', [
  PLAYBOOK_CAPABILITIES.ORCHESTRATION,
  PLAYBOOK_CAPABILITIES.CORRELATION,
  PLAYBOOK_CAPABILITIES.MCP_INVOKE,
  PLAYBOOK_CAPABILITIES.GRAPHQL_INVOKE,
  PLAYBOOK_CAPABILITIES.CODEGEN,
]));
```

Update `server` built-in to include the 4 risk-bearing capabilities
(and remove `TRIGGERS`):

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

### Schema query methods

Add to `PlaybookSchemaDescriptor` or as standalone functions in
`playbook-schema.ts`:

- `isBuiltIn(schema: string): boolean` — returns true for `client`,
  `server`, `assisted`
- `isDomainSchema(schema: string): boolean` — returns true if name
  contains `-` and is not built-in

Platform uses `PlaybookSchemas.isBuiltIn()` as a static method. TS
already has `isBuiltInSchema()` in `playbook.ts` — update it to
include `assisted`.

Add `hasCapability(cap: string)` to `PlaybookSchemaDescriptor` interface
(checking `capabilities.has(cap)`).

### Tests

- Verify `assisted` schema has server caps minus risk-bearing
- Verify `server` schema has all caps including risk-bearing
- Verify `isBuiltIn` returns true for all 3 built-in schemas
- Verify `isDomainSchema` returns true for hyphenated non-built-in names

---

## 2. Canonical Form (#833)

### YAML key change: `forEach` → `for-each`

The TS code uses `forEach` (camelCase) in multiple locations. All must
change to `for-each` (kebab-case) to match platform.

**`types.ts`:**
- `YamlImport` interface: rename `forEach` property to use bracket
  notation or index signature for `'for-each'`
- `ForEachDirective` — keep the type name but update any string literals
- Error messages referencing "forEach" → "for-each"

**`walker.ts`:**
- `RESERVED_KEYS` / `DECORATOR_KEYS` / `PROMOTABLE_DECORATORS` —
  change `'forEach'` to `'for-each'` in all sets/arrays
- All string comparisons checking for `forEach` key

**`foreach-expander.ts`:**
- Update any YAML key references from `forEach` to `for-each`
- The file name stays — it describes the concept, not the YAML key

**Tests:**
- Update all test YAML fixtures using `forEach:` to `for-each:`
- Update string assertions checking for `forEach`

### Interaction with #673

Issue #673 covers renaming `forEach:` in composition YAML files (page
templates, module imports). This spec covers only the parser/types code
changes. #673 is a separate mechanical find-and-replace on YAML content
files.

---

## 3. Scalar Subjects (#726)

### Current state

`definition-parser.ts` already handles scalar for `agent-session-close`
and `agent-session-clear`. Three step types need adding:

| Step type | Scalar meaning |
|---|---|
| `graphql-exec` | Query string |
| `mcp-call` | Tool name |
| `rest-request` | URL (implies GET method) |

### Implementation

In the invoke binding parser (wherever `parseInvoke` or equivalent
lives), add scalar string handling for these 3 step types following
the existing pattern for `agent-session-close`/`agent-session-clear`.

For `rest-request`, scalar string maps to `{ method: 'GET', url: value }`.

### Tests

- Each step type: verify scalar string accepted and parsed correctly
- Verify map form still works (no regression)

---

## 4. Test Rules, Headers, Lint (#834)

### Tutorial headers

Test YAML files should support a meta block with:
- `level` (1-5) — difficulty
- `layer` — which layer the test covers
- `teaches` — concept taught
- `builds-on` — prerequisite concepts

### Assertion-quality lint

Reject tests with only `succeeded`/`stepCount` assertions — these
verify execution but not behavior. Tests must assert on specific
outputs or state.

### Implementation scope

Review existing TS test YAML files. Add headers where appropriate.
Determine whether assertion-quality lint applies to the TS test
runner or is Java-only tooling.

---

## 5. Category-Level Behavioral Tests (#850)

### Structure

Platform organizes playbook example tests by category, with one
`execution.test.yaml` per category. 8 categories:

1. `flow-control`
2. `step-workflows`
3. `composition`
4. `concurrency-patterns`
5. `coordination`
6. `coordination-primitives`
7. `invoke-bindings`
8. `data-delivery`

Each test uses `validate-playbook` pointing at the category directory,
then `assertThat` on `validatedCount`, `errors`, `headerErrors`.

### TS port

Create equivalent category test structure in
`packages/yaml-core/test/` or `packages/yaml-core/src/test/`.
Categories that apply to client playbooks may differ from server —
assess which of the 8 categories have TS-side equivalents.

---

## References

- `platform/yaml-core/.../playbook/PlaybookCapabilities.java` — capability constants
- `platform/yaml-core/.../playbook/PlaybookSchemas.java` — isBuiltIn, isDomainSchema
- `platform/yaml-core/.../playbook/MapPlaybookSchemaRegistry.java` — ASSISTED schema definition
- `platform/yaml-core/.../playbook/PlaybookSchemaDescriptor.java` — record shape
- `platform/yaml-core/.../step/DeclarationParser.java` — scalar subject handling
- `platform/docs/specs/issue-834-rules-headers-lint-playbook-tests/` — test conventions spec
- `pages/packages/yaml-core/src/playbook-schema.ts` — current TS capabilities and registry
- `pages/packages/yaml-core/src/types.ts` — YamlImport, ForEachDirective
- `pages/packages/yaml-core/src/step/` — step type handling
- Issue #673 — companion issue for YAML file renames
- Issue #669 — parent: playbook language direction
