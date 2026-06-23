import { loadSite } from "@casehubio/pages-runtime";
import { page, table, dataset, lookup, groupBy, col, count } from "@casehubio/pages-ui";

const dashboard = page("Example Dashboard",
  table({
    lookup: lookup("sample", groupBy("category", col("category"), count("total")))
  }),
  {
    datasets: [
      dataset("sample", "/api/data/sample")
    ]
  }
);

const container = document.getElementById("app");
if (container) {
  loadSite(container, dashboard).catch(console.error);
}
