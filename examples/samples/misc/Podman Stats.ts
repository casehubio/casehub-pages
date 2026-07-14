// @ts-nocheck
import { page, bind, restSource, html, markdown, barChart, table, columns, selector, tabs, div, withStyle, lookup } from "@casehubio/pages-ui";

const imagesDs = bind("images", restSource("${baseUrl}/images/json", {
  expression: `$.[Id, Names[0], $fromMillis(Created * 1000), Size, Containers]`,
  columns: [
    { id: "ID", type: "label" },
    { id: "name", type: "label" },
    { id: "created", type: "date" },
    { id: "size", type: "number" },
    { id: "containers", type: "number" },
  ],
}));

const containersDs = bind("containers", restSource("${baseUrl}/containers/json?filters={%22status%22:%20[%22created%22,%22running%22,%22paused%22,%22exited%22]}", {
  expression: `$.[Id, Names[0], Image, $fromMillis(Created * 1000), State, Status]`,
  columns: [
    { id: "ID", type: "label" },
    { id: "name", type: "label" },
    { id: "image", type: "label" },
    { id: "created", type: "date" },
    { id: "State", type: "label" },
    { id: "Status", type: "label" },
  ],
}));

export default page("Podman Stats",
  html(`<h1><strong>Podman Dashboard</strong></h1> <p> This is a dashboard to provide basic information about Podman</p> <p> It uses <a href="https://docs.podman.io/en/latest/_static/api.html">Podman REST API</a>, so make sure podman service is running on localhost on port 8000 with CORS enabled</p> <p> The following command starts the podman service: </p> <p><em>podman system service tcp:localhost:8000 --cors https://jesuino.github.io  -t 0 </em></strong></p>`),

  tabs({ navGroupId: "podman_nav_group", targetDivId: "podman_tabs_div" }),
  div({ divId: "podman_tabs_div", width: "100%" }),

  columns({}, ["6", "6"],
    [
      markdown("**Images by Size**"),
      barChart({
        subtype: "BAR",
        extraConfiguration: `"series": { "label": { "position": "top" } }`,
        lookup: lookup("images", { type: "rowCount", count: 7 },
          {
            type: "group",
            groupingKey: { sourceId: "name" },
            functions: [
              { source: "name" },
              { source: "size", column: "Total Size" },
            ],
          },
          { type: "sortOps", column: "Total Size", sortOrder: "DESCENDING" }),
        chart: { height: "350", resizable: true, margin: { left: "120" } },
      }),
    ],
    [
      markdown("**Containers by Image**"),
      barChart({
        subtype: "BAR",
        lookup: lookup("images", { type: "rowCount", count: 7 },
          {
            type: "filter",
            column: "containers",
            function: "GREATER_THAN",
            args: [0],
          },
          {
            type: "group",
            groupingKey: { sourceId: "name" },
            functions: [
              { source: "name" },
              { source: "containers", column: "containers total" },
            ],
          },
          { type: "sort", column: "containers total", sortOrder: "DESCENDING" }),
        chart: { width: "500", height: "350", resizable: true, margin: { left: "120" } },
        columns: [{ id: "containers total", pattern: "#" }],
      }),
    ]
  ),

  markdown("**Images List**"),
  table({
    lookup: lookup("images"),
    table: { sort: { enabled: true } },
  }),

  markdown("**Filters**"),
  withStyle({ "font-size": "small" }, html("")),

  columns({}, ["2", "2"],
    [
      withStyle({ width: "200px" },
        selector({
          lookup: lookup("containers", {
            type: "groupOps",
            groupingKey: { sourceId: "image" },
            functions: [{ source: "image", column: "image" }],
          }),
          filter: { notification: "true" },
        })
      ),
    ],
    [
      withStyle({ width: "200px" },
        selector({
          lookup: lookup("containers", {
            type: "groupOps",
            groupingKey: { sourceId: "state" },
            functions: [{ source: "state", column: "state" }],
          }),
          filter: { notification: true },
        })
      ),
    ]
  ),

  columns({ "margin-top": "20px" }, ["5", "6"],
    [
      withStyle({ "font-size": "medium" }, html("<strong>Containers by State</strong>")),
      barChart({
        subtype: "BAR",
        lookup: lookup("containers", { type: "rowCount", count: 7 },
          {
            type: "group",
            groupingKey: { sourceId: "state" },
            functions: [
              { source: "state" },
              { source: "state", function: "COUNT", column: "total" },
            ],
          }),
        filter: { listening: true },
        chart: { width: "500", height: "350", resizable: true, margin: { left: "70" } },
        columns: [{ id: "total", pattern: "#" }],
      }),
    ],
    [
      markdown("**Containers by Image**"),
      withStyle({ "font-size": "medium" }, html("")),
      barChart({
        subtype: "BAR",
        lookup: lookup("containers", { type: "rowCount", count: 7 },
          {
            type: "group",
            groupingKey: { sourceId: "image" },
            functions: [
              { source: "image" },
              { source: "image", function: "Count", column: "Total" },
            ],
          },
          { type: "sort", column: "Total", sortOrder: "DESCENDING" }),
        filter: { listening: true },
        chart: { width: "500", height: "350", resizable: true, margin: { left: "120" } },
      }),
    ]
  ),

  withStyle({ size: "xl" }, html("")),
  table({
    lookup: lookup("containers"),
    table: { sort: { enabled: true } },
  }),
  { properties: { baseUrl: "http://localhost:8000" }, datasets: [imagesDs, containersDs] }
);
