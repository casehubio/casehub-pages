// @ts-nocheck
import { page, bind, restSource, html, table, lookup} from "@casehubio/pages-ui";

const quarkusReposDs = bind("quarkus_repos", restSource("https://api.github.com/search/repositories?q=quarkus&sort=updated&per_page=30", {
    cacheEnabled: true,
    expression: '$.items.[[$full_name, $.description, $.stargazers_count, $.language, $.updated_at]]',
    columns: [
      { id: "Repository", type: "LABEL" },
      { id: "Description", type: "LABEL" },
      { id: "Stars", type: "NUMBER" },
      { id: "Language", type: "LABEL" },
      { id: "Updated", type: "LABEL" }
    ]
  }));

export default page(
  "GitHub Quarkus Repos",
  html(`
    <p style="font-size: x-large"><strong>Quarkus Repositories</strong></p>
    <small>Recently updated repositories matching "quarkus" on GitHub</small>
    <hr />
  `),
  table({
    height: 600,
    resizable: true,
    lookup: lookup("quarkus_repos", )
  }),
  { datasets: [quarkusReposDs] });
