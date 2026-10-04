## D1: Migrate all existing delivery types to the SPI

**Choice:** Migrate graphql, rest, simulated, and aria to DeliveryHandler implementations
**Alternatives:**
- SPI for new types only — less churn but two dispatch paths (switch + SPI lookup)
- Migrate rest+simulated only — partial migration, aria stays hardcoded for batching
**Rationale:** Uniform dispatch validates the SPI with known types, eliminates the sealed-interface constraint, and ensures plugin-provided handlers have the same capabilities as built-in ones.
**Trade-offs:** More upfront work migrating existing dispatchers; aria batching needs special handling in the executor.
**Sources:** ScenarioExecutor.java:73-79 (hardcoded switch), ScenarioParser.java:94-99 (delivery switch)
**Exploration:** quick
**Status:** captured

## D2: Generic + typed step model

**Choice:** Add GenericStep(name, delivery, data:Map) to the sealed ScenarioStep interface for plugin types. Keep AriaStep for ARIA shorthand parsing.
**Alternatives:**
- All generic — replace all typed records with a single GenericStep. Loses compile-time field safety.
- Unsealed interface — plugin modules provide own records. Requires plugin JARs on parser classpath.
**Rationale:** GenericStep handles arbitrary delivery modes without parser changes. AriaStep is retained because ARIA uses a distinct shorthand syntax (action-based, no delivery field). Built-in handlers for graphql/rest/simulated extract fields from the GenericStep data map, same as plugins.
**Trade-offs:** Built-in handlers lose compile-time field access (e.g., GraphQLStep.domain()) — must extract from Map. Acceptable since the handler owns the field contract.
**Sources:** ScenarioStep.java (sealed interface with 4 records), ScenarioParser.java:67-99 (parsing logic)
**Exploration:** quick
**Depends on:** D1 (migrating all types means GenericStep must carry all delivery data)

## D3: StepOutcome return type with DeliveryContext

**Choice:** execute(String name, Map<String,Object> data, DeliveryContext ctx) returns StepOutcome(success, name, result:Map). DeliveryContext carries config, variable context, await support.
**Alternatives:**
- Raw map in/out — minimal but caller must handle errors and context injection
- Full step object — tighter coupling to executor internals (ScenarioConfig, VariableContext)
**Rationale:** Mirrors the existing ExecutionResult shape. DeliveryContext is a clean boundary — handlers get what they need without depending on executor internals. StepOutcome captures success/failure uniformly.
**Trade-offs:** DeliveryContext is a new type that must be maintained as executor needs evolve.
**Sources:** ExecutionResult (existing), DataProvider interface (established CDI SPI pattern in this codebase)
**Exploration:** quick

## D4: DeliveryHandler interface in scenario module

**Choice:** Place DeliveryHandler, StepOutcome, and DeliveryContext in backend/scenario (the model module)
**Alternatives:**
- New scenario-spi module — minimal dependency surface but more modules to maintain
- scenario-runtime module — simpler but forces plugins to depend on full runtime
**Rationale:** backend/scenario already contains ScenarioStep and is depended on by scenario-runtime. Plugin modules already need the step types, so adding the SPI interface here adds no new dependencies. Follows the DataProvider pattern (interface in data module, implementations in data-sql/data-iotdb/etc.).
**Trade-offs:** Scenario module grows slightly. If the SPI surface ever becomes large, extracting to a dedicated module is straightforward.
**Sources:** DataProvider.java (interface in data module), DataResource.java (CDI injection with Instance<DataProvider>)
**Exploration:** quick

## D5: Executor retains batching and await logic

**Choice:** Batching and await wrapping remain in ScenarioExecutor, not in the SPI
**Alternatives:**
- Optional SPI batching method — more flexible but every handler must decide
- No batching — remove aria batching entirely, simpler but degrades performance
**Rationale:** Batching is an executor-level optimization that only ARIA needs today. Await is orthogonal to delivery — the executor wraps handler.execute() in AwaitEngine when the step has an await condition. Keeping both in the executor means handlers just implement single-step execute() — maximally simple SPI.
**Trade-offs:** If a future handler needs custom batching, the executor would need a batch-aware path. Can be added later via an optional interface extension.
**Sources:** ScenarioExecutor.java:47-54 (batch collection), AwaitEngine usage in executeGraphQL/executeRest
**Exploration:** quick
**Depends on:** D3 (handler returns StepOutcome, executor wraps with await)
