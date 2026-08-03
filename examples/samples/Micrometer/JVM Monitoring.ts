import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, metric, barChart, dataTable, title, lookup, filterBy, groupBy, max, sortBy, col } from "@casehubio/pages-ui";

const popDs = bind("pop", restSource("${metricsUrl}", dataSetId("pop"), {
  columns: [
    { id: "Metric" as ColumnId, type: ColumnType.LABEL },
    { id: "Labels" as ColumnId, type: ColumnType.LABEL },
    { id: "Value" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("JVM Monitoring",
  metric({
    lookup: lookup("pop",
      filterBy("Metric", "EQUALS_TO", "system_cpu_usage"),
      sortBy("Total", "DESCENDING"),
      groupBy(null, max("Value"))),
    title: "System CPU Usage",
    height: "200",
    columns: [{ id: "Total" as ColumnId, expression: "value * 100" }],
  }),

  title("Threads"),

  barChart({
    lookup: lookup("pop",
      filterBy("Metric", "EQUALS_TO", "jvm_threads_states_threads"),
      sortBy("Total", "DESCENDING"),
      groupBy("Labels", col("Labels"), max("Value", "Total"))),
    resizable: true,
    height: "300",
    margin: { left: 90 },
    columns: [{ id: "Labels" as ColumnId, expression: `value.replaceAll('state="', '').replaceAll('",', '')` }],
  }),

  title("JVM Memory Used Bytes"),

  barChart({
    lookup: lookup("pop",
      filterBy("Metric", "EQUALS_TO", "jvm_memory_used_bytes"),
      sortBy("Total", "DESCENDING"),
      groupBy("Labels", col("Labels"), max("Value", "Total"))),
    xAxis: { labelAngle: 10 },
    resizable: true,
    height: "300",
    margin: { left: 90 },
    columns: [
      { id: "Total" as ColumnId, pattern: "#" },
      {
        id: "Labels" as ColumnId,
        expression: `value.replaceAll('id="', ' ').replaceAll('area="heap",', "").replaceAll('area="nonheap",', "").replaceAll('",', "").trim()`,
      },
    ],
  }),

  title("All Metrics"),

  dataTable({
    lookup: lookup("pop"),
    height: "400",
    resizable: true,
  }),
  {
    properties: { refreshInterval: "5", metricsUrl: "data/quarkus/metrics" },
    datasets: [popDs],
  }
);
