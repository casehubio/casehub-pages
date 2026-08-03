import { page, bind, restSource, html, markdown, barChart, dataTable, columns, selector, rows, withStyle, lookup, groupBy, col, count, filterBy, sortBy } from "@casehubio/pages-ui";

import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";

const imagesDs = bind("images", restSource("${baseUrl}/images/json", dataSetId("images"), {
  expression: `$.[Id, Names[0], $fromMillis(Created * 1000), Size, Containers]`,
  columns: [
    { id: "ID" as ColumnId, type: ColumnType.LABEL },
    { id: "name" as ColumnId, type: ColumnType.LABEL },
    { id: "created" as ColumnId, type: ColumnType.DATE },
    { id: "size" as ColumnId, type: ColumnType.NUMBER },
    { id: "containers" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

const containersDs = bind("containers", restSource("${baseUrl}/containers/json?filters={%22status%22:%20[%22created%22,%22running%22,%22paused%22,%22exited%22]}", dataSetId("containers"), {
  expression: `$.[Id, Names[0], Image, $fromMillis(Created * 1000), State, Status]`,
  columns: [
    { id: "ID" as ColumnId, type: ColumnType.LABEL },
    { id: "name" as ColumnId, type: ColumnType.LABEL },
    { id: "image" as ColumnId, type: ColumnType.LABEL },
    { id: "created" as ColumnId, type: ColumnType.DATE },
    { id: "State" as ColumnId, type: ColumnType.LABEL },
    { id: "Status" as ColumnId, type: ColumnType.LABEL },
  ],
}));

export default page("Podman Stats",
  html(`<h1><strong>Podman Dashboard</strong></h1> <p> This is a dashboard to provide basic information about Podman</p> <p> It uses <a href="https://docs.podman.io/en/latest/_static/api.html">Podman REST API</a>, so make sure podman service is running on localhost on port 8000 with CORS enabled</p> <p> The following command starts the podman service: </p> <p><em>podman system service tcp:localhost:8000 --cors https://jesuino.github.io  -t 0 </em></strong></p>`),



  columns([6, 6],
    [
      markdown("**Images by Size**"),
      barChart({
        subtype: "bar",
        extra: { "series": { "label": { "position": "top" } } },
        lookup: lookup("images",
          groupBy("name", col("name"), col("size", "Total Size")),
          sortBy("Total Size", "DESCENDING")),
        height: "350",
        resizable: true,
        margin: { left: 120 },
      }),
    ],
    [
      markdown("**Containers by Image**"),
      barChart({
        subtype: "bar",
        lookup: lookup("images",
          filterBy("containers", "GREATER_THAN", 0),
          groupBy("name", col("name"), col("containers", "containers total")),
          sortBy("containers total", "DESCENDING")),
        width: "500",
        height: "350",
        resizable: true,
        margin: { left: 120 },
        columns: [{ id: "containers total" as ColumnId, pattern: "#" }],
      }),
    ]
  ),

  markdown("**Images List**"),
  dataTable({
    lookup: lookup("images"),
    sortable: true,
  }),

  markdown("**Filters**"),
  withStyle({ "font-size": "small" }, html("")),

  columns([2, 2],
    [
      withStyle({ width: "200px" },
        selector({
          lookup: lookup("containers", groupBy("image", col("image"))),
          filter: { notification: true },
        })
      ),
    ],
    [
      withStyle({ width: "200px" },
        selector({
          lookup: lookup("containers", groupBy("state", col("state"))),
          filter: { notification: true },
        })
      ),
    ]
  ),

  withStyle({ "margin-top": "20px" }, columns([5, 6],
    [
      withStyle({ "font-size": "medium" }, html("<strong>Containers by State</strong>")),
      barChart({
        subtype: "bar",
        lookup: lookup("containers",
          groupBy("state", col("state"), count("state", "total"))),
        filter: { listening: true },
        width: "500",
        height: "350",
        resizable: true,
        margin: { left: 70 },
        columns: [{ id: "total" as ColumnId, pattern: "#" }],
      }),
    ],
    [
      markdown("**Containers by Image**"),
      withStyle({ "font-size": "medium" }, html("")),
      barChart({
        subtype: "bar",
        lookup: lookup("containers",
          groupBy("image", col("image"), count("image", "Total")),
          sortBy("Total", "DESCENDING")),
        filter: { listening: true },
        width: "500",
        height: "350",
        resizable: true,
        margin: { left: 120 },
      }),
    ]
  )),

  withStyle({ size: "xl" }, html("")),
  dataTable({
    lookup: lookup("containers"),
    sortable: true,
  }),
  { properties: { baseUrl: "http://localhost:8000" }, datasets: [imagesDs, containersDs] }
);
