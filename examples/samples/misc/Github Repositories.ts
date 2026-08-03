import { page, bind, restSource, title, barChart, dataTable, lookup, groupBy, col } from "@casehubio/pages-ui";

import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";

const githubReposDs = bind("github_repos", restSource("https://api.github.com/search/repositories?q=stars:>1&s=stars", dataSetId("github_repos"), {
  cacheEnabled: true,
  refreshTime: "10minute",
  expression: `$.items.[name, stargazers_count, forks, watchers_count, open_issues, owner.login, created_at, language ? language : '-', description ]`,
  columns: [
    { id: "name" as ColumnId, type: ColumnType.LABEL },
    { id: "stars" as ColumnId, type: ColumnType.NUMBER },
    { id: "forks" as ColumnId, type: ColumnType.NUMBER },
    { id: "watchers" as ColumnId, type: ColumnType.NUMBER },
    { id: "open_issues" as ColumnId, type: ColumnType.NUMBER },
    { id: "owner_login" as ColumnId, type: ColumnType.LABEL },
    { id: "created" as ColumnId, type: ColumnType.LABEL },
    { id: "language" as ColumnId, type: ColumnType.LABEL },
    { id: "description" as ColumnId, type: ColumnType.TEXT },
  ],
}));

export default page("Github Repositories",
  title("Top 10 GitHub Repositories by Stars"),
  barChart({
    lookup: lookup("github_repos",
      groupBy("name", col("name"), col("stars"))),
    xAxis: { labelAngle: -10 },
    resizable: true,
  }),
  title("List of top repositories by stars"),
  dataTable({
    lookup: lookup("github_repos"),
    resizable: true,
  }),
  { datasets: [githubReposDs] }
);
