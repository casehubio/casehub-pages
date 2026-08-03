import { page, bind, restSource, html, dataTable, lookup } from "@casehubio/pages-ui";
import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";

const quarkusReposDs = bind("quarkus_repos", restSource("https://api.github.com/search/repositories?q=quarkus&sort=updated&per_page=30", dataSetId("quarkus_repos"), {
    cacheEnabled: true,
    expression: '$.items.[[$full_name, $.description, $.stargazers_count, $.language, $.updated_at]]',
    columns: [
      { id: "Repository" as ColumnId, type: ColumnType.LABEL },
      { id: "Description" as ColumnId, type: ColumnType.LABEL },
      { id: "Stars" as ColumnId, type: ColumnType.NUMBER },
      { id: "Language" as ColumnId, type: ColumnType.LABEL },
      { id: "Updated" as ColumnId, type: ColumnType.LABEL },
    ],
  }));

export default page(
  "GitHub Quarkus Repos",
  html(`
    <p style="font-size: x-large"><strong>Quarkus Repositories</strong></p>
    <small>Recently updated repositories matching "quarkus" on GitHub</small>
    <hr />
  `),
  dataTable({
    height: "600",
    resizable: true,
    lookup: lookup("quarkus_repos"),
  }),
  { datasets: [quarkusReposDs] },
);
