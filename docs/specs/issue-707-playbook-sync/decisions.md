# Decisions — #707 Playbook Sync

## D1: Canonical form key representation

**Choice:** Kebab-case keys (`for-each`) throughout TS types and code
**Alternatives:**
- CamelCase with normalization layer — more idiomatic TS but adds translation complexity
- Accept both forms, canonicalize on output — runtime overhead, two code paths to maintain
**Rationale:** Matches Java directly, keeps YAML↔code alignment simple, avoids a normalization layer
**Trade-offs:** Bracket notation needed for kebab-case keys on TS interfaces; less idiomatic TS
**Sources:** platform PlaybookCapabilities.java, pages yaml-core walker.ts, types.ts
**Exploration:** quick
**Status:** captured

## D2: @Plugin step types scope

**Choice:** Skip for this issue
**Alternatives:**
- Port catalog shape only — update CatalogSource types if API changed
- Full port with TS decorators — creates annotation-scanning equivalent
**Rationale:** TS PluginRegistry already serves the same purpose via manual registration. @Plugin is a Java compile-time mechanism with no direct TS analogue
**Trade-offs:** If platform catalog shape changed, TS types may drift — verify separately
**Sources:** pages yaml-core plugin-registry.ts, step/sources/plugin-source.ts
**Exploration:** quick
**Status:** captured

## D3: TRIGGERS capability

**Choice:** Remove from TS code
**Alternatives:**
- Keep as TS-only capability — would need a reason to diverge from platform
**Rationale:** Does not exist in platform PlaybookCapabilities.java. Leftover from an earlier iteration
**Trade-offs:** None — removing dead code
**Sources:** platform PlaybookCapabilities.java (no TRIGGERS), pages playbook-schema.ts:30
**Exploration:** quick
**Status:** captured

## D4: Test infrastructure scope

**Choice:** Port both #834 (rules/headers/lint) and #850 (category behavioral tests)
**Alternatives:**
- Defer both — focus on runtime parity only
- Port #850 only — category tests add conformance, skip lint conventions
**Rationale:** Full sync ensures cross-parser test suite stays aligned with platform conventions
**Trade-offs:** More work, but test infrastructure divergence compounds over time
**Sources:** issue #707 scope list
**Exploration:** quick
**Status:** captured

## D5: Work ordering

**Choice:** Schema-first bottom-up: trust model → canonical form → scalar subjects → test infra
**Alternatives:**
- Canonical form first — riskiest change first, less undo if issues
- Platform WS order — follows development timeline (WS-3→WS-4→WS-5)
**Rationale:** Additive trust model changes first (low risk, establishes capability surface), riskiest parser changes in the middle while most tests still pass, test infrastructure last when runtime shape is final
**Trade-offs:** If canonical form breaks things, trust model tests may need revisiting
**Sources:** issue #707 scope analysis
**Exploration:** quick
**Status:** captured
