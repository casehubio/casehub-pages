/**
 * Pre-attachment configuration contract for hosted Web Components.
 *
 * **Call timing:** `configure(props)` is called before the element is appended
 * to the DOM — before `connectedCallback()` fires. Components should store
 * configuration without triggering rendering at this point.
 *
 * **Re-configuration:** `configure()` may be called again after initial render
 * (e.g. navigation to a different item). Implementations must handle re-entry:
 * tear down prior state and re-initialize with the new props.
 *
 * **Props content:** `props` contains the YAML `panelProps` values. The generic
 * `P` gives component authors type safety for their specific props shape; the
 * runtime calls with `Record<string, unknown>`.
 */
export interface ConfigurablePanel<P extends Record<string, unknown> = Record<string, unknown>> {
  configure(props: P): void;
}

/**
 * Data delivery contract for components receiving pipeline data.
 *
 * **Mutual-clearing invariant:** implementations must clear `error` when
 * `dataSet` is set, and clear `dataSet` when `error` is set. The pipeline
 * delivers one or the other per cycle, never both — but stale values from
 * a prior cycle must not persist alongside fresh values from the current one.
 */
export interface DataReceiver {
  dataSet: unknown;
  error: string;
}
