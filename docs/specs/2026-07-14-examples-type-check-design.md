# Examples Type-Check Migration

**Issue:** #179
**Date:** 2026-07-14
**Scale:** M · **Complexity:** Low

## Problem

The 44 `.ts` files in `examples/samples/` are not type-checked. The examples `tsconfig.json` only includes `src/` and is missing project references for `pages-data` and `pages-ui`. Additionally, ~22 files use a legacy `page()` calling convention that predates the current TypeScript API and won't compile against the current signature.

## Legacy Convention

```typescript
export default page(
  { prometheusUrl: "..." },              // properties object (no string name)
  { displayer: { refresh: {...} } },      // defaults object (cascading config)
  [ component1, component2 ],            // components array
  { datasets: [ds1] }                    // trailing options
);
```

Some files also have syntax errors (e.g., broken `restSource` calls).

## Current API

```typescript
export default page("Prometheus Basic",
  component1,
  component2,
  { properties: { prometheusUrl: "..." }, datasets: [ds1] }
);
```

- First arg: string name (derived from filename)
- Rest args: components as varargs
- Last arg (optional): `PageOptions` with `datasets`, `properties`, `settings`

## Migration Rules

1. **Page name** — derive from filename (e.g., `"Prometheus Basic"` from `Prometheus Basic.ts`)
2. **Properties** — move from 1st arg object to `PageOptions.properties`
3. **Displayer defaults** — push down into individual component options. No implicit cascading.
   - `chart.resizable`, `chart.height`, `chart.margin` → each component's options
   - `refresh.interval` → drop (monitoring URLs won't be live in examples gallery)
   - `lookup.uuid` → already handled by per-component `lookup()` calls
4. **Components** — unwrap from array to varargs
5. **Datasets** — keep in `PageOptions.datasets`
6. **Syntax errors** — fix as encountered

## tsconfig Changes

1. Add `"samples"` to `include` array (alongside existing `"src"`)
2. Add project references for `pages-data` and `pages-ui`

## Files to Migrate

22 legacy files across: Prometheus (2), Micrometer (3), misc (6), Backstage (1), ansible (1), Clinical (1), IoT (1), jupyterhub (2), kepler (1), modelmesh (1), OpenTelemetry (1), People (1), Sales (1), triton (1).

## Verification

- `yarn typecheck` passes with zero errors
- `yarn lint` passes
- Examples gallery builds and renders correctly
