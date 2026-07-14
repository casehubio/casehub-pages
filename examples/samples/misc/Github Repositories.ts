// @ts-nocheck
import { page, bind, restSource, title, barChart, table, lookup } from "@casehubio/pages-ui";

const githubReposDs = bind("github_repos", restSource("https://api.github.com/search/repositories?q=stars:>1&s=stars", {
  cacheEnabled: "true",
  refreshTime: "10minute",
  expression: `$.items.[name, stargazers_count, forks, watchers_count, open_issues, owner.login, created_at, language ? language : '-', description ]`,
  columns: [
    { id: "name", type: "label" },
    { id: "stars", type: "number" },
    { id: "forks", type: "number" },
    { id: "watchers", type: "number" },
    { id: "open_issues", type: "number" },
    { id: "owner_login", type: "label" },
    { id: "created", type: "label" },
    { id: "language", type: "label" },
    { id: "description", type: "text" },
  ],
}));

export default page("Github Repositories",
  title("Top 10 GitHub Repositories by Stars"),
  barChart({
    lookup: lookup("github_repos", { type: "rowCount", count: 10 },
      {
        type: "group",
        groupingKey: { sourceId: "name" },
        functions: [
          { source: "name" },
          { source: "stars" },
        ],
      }),
    axis: { x: { labels_angle: -10 } },
    chart: { resizable: true },
  }),
  title("List of top repositories by stars"),
  table({
    lookup: lookup("github_repos"),
    chart: { resizable: true },
  }),
  { datasets: [githubReposDs] }
);
