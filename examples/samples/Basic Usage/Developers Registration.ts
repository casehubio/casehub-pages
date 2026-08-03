import { page, bind, restSource, html, iframePlugin, barChart, dataTable, rows, columns, lookup, groupBy, col, sortBy, withStyle } from "@casehubio/pages-ui";
import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";

const devsDs = bind("devs", restSource("https://dev-register-secure-melviz.kie-tooling-0ad6762cc85bcef5745bb684498c2436-0000.us-south.containers.appdomain.cloud/developers", dataSetId("devs"), {
    expression: "$.[name, language, workingYears]",
    columns: [
      { id: "Name" as ColumnId, type: ColumnType.TEXT },
      { id: "Language" as ColumnId, type: ColumnType.LABEL },
      { id: "Working Years" as ColumnId, type: ColumnType.LABEL },
    ],
  }));

const uniformsSchema = {
  title: "Developers",
  type: "object",
  properties: {
    name: { type: "string" },
    language: { type: "string" },
    workingYears: {
      description: "Work experience in years",
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
  },
  required: ["name", "language", "workingYears"],
};

export default page(
  "Developers Registration",
  rows(
    columns([12],
      [
        withStyle({ fontSize: "x-large", marginBottom: "20px" }, html("Developers registration")),
        iframePlugin({
          componentId: "uniforms",
          height: "350px",
          settings: {
            "uniforms.url": "https://dev-register-secure-melviz.kie-tooling-0ad6762cc85bcef5745bb684498c2436-0000.us-south.containers.appdomain.cloud/developers",
            "uniforms.schema": JSON.stringify(uniformsSchema),
          },
        }),
      ],
    ),
    columns([12],
      [withStyle({ fontSize: "large" }, html("<strong>Data</strong> <hr />"))],
    ),
    columns([4, 4],
      [
        withStyle({ fontSize: "small" }, html("<strong>Working Years</strong><hr />")),
        barChart({
          subtype: "bar",
          height: "200",
          margin: { left: 30 },
          refresh: { interval: 2 },
          columns: [{ id: "Total" as ColumnId, pattern: "#" }],
          lookup: lookup("devs", sortBy("Total", "DESCENDING"),
            groupBy("Working Years", col("Working Years"))),
        }),
      ],
      [
        withStyle({ fontSize: "small" }, html("<strong>Language</strong><hr />")),
        barChart({
          subtype: "bar",
          height: "200",
          margin: { left: 80 },
          refresh: { interval: 2 },
          columns: [{ id: "Total" as ColumnId, pattern: "#" }],
          lookup: lookup("devs", sortBy("Total", "DESCENDING"),
            groupBy("Language", col("Language"))),
        }),
      ],
    ),
    columns([12],
      [
        dataTable({
          resizable: true,
          sortable: true,
          refresh: { interval: 2 },
          lookup: lookup("devs"),
        }),
      ],
    ),
  ),
  { datasets: [devsDs] },
);
