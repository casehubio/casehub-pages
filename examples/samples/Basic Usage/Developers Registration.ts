import { page, bind, restSource, html, iframePlugin, barChart, table, rows, columns, lookup, groupBy, col, sortBy} from "@casehubio/pages-ui";

const devsDs = bind("devs", restSource("https://dev-register-secure-melviz.kie-tooling-0ad6762cc85bcef5745bb684498c2436-0000.us-south.containers.appdomain.cloud/developers", {
    expression: "$.[name, language, workingYears]",
    columns: [
      { id: "Name", type: "Text" },
      { id: "Language", type: "Label" },
      { id: "Working Years", type: "label" }
    ]
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
      maximum: 100
    }
  },
  required: ["name", "language", "workingYears"]
};

export default page(
  "Developers Registration",
  rows(
    columns(
      [12],
      [
        html("Developers registration", { fontSize: "x-large", marginBottom: "20px" }),
        iframePlugin({
          componentId: "uniforms",
          height: "350px",
          properties: {
            "uniforms.url": "https://dev-register-secure-melviz.kie-tooling-0ad6762cc85bcef5745bb684498c2436-0000.us-south.containers.appdomain.cloud/developers",
            "uniforms.schema": JSON.stringify(uniformsSchema)
          }
        })
      ]
    ),
    columns(
      [12],
      [html("<strong>Data</strong> <hr />", { fontSize: "large" })]
    ),
    columns(
      [4],
      [
        html("<strong>Working Years</strong><hr />", { fontSize: "small" }),
        barChart({
          subtype: "bar",
          height: 200,
          margin: { left: 30 },
          refresh: { interval: 2 },
          columns: [{ id: "Total", pattern: "#" }],
          lookup: lookup("devs", sortBy("Total", "DESCENDING"),
            groupBy("Working Years", col("Working Years")))
        })
      ],
      [4],
      [
        html("<strong>Language</strong><hr />", { fontSize: "small" }),
        barChart({
          subtype: "bar",
          height: 200,
          margin: { left: 80 },
          refresh: { interval: 2 },
          columns: [{ id: "Total", pattern: "#" }],
          lookup: lookup("devs", sortBy("Total", "DESCENDING"),
            groupBy("Language", col("Language")))
        })
      ]
    ),
    columns(
      [12],
      [
        table({
          resizable: true,
          sort: { enabled: true },
          refresh: { interval: 2 },
          lookup: lookup("devs", )
        })
      ]
    )
  ),
  { datasets: [devsDs] });
