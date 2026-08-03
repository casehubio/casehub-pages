import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, html, metric, columns, lookup, withStyle, filterBy, groupBy, col } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("data/metrics", dataSetId("metrics"), {
  cacheEnabled: true,
  refreshTime: "1minute",
  columns: [
    { id: "metric" as ColumnId, type: ColumnType.LABEL },
    { id: "labels" as ColumnId, type: ColumnType.LABEL },
    { id: "Value" as ColumnId, type: ColumnType.NUMBER },
  ],
  headers: {
    Authorization: "${authorizationHeader}",
    "Content-Type": "text/plain",
    "Target-Url": "${towerUrl}/api/v2/metrics/?metrics",
  },
}));

export default page("Ansible Metrics",
  // Header
  html(`<p><a href="\${towerUrl}" style="font-size: xx-large">Ansible Tower</a><small>Metrics Summary</small></p> <hr />`),

  // Access section
  html(`<p style="\${subTitlesStyle}">Access</p>`),

  columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_sessions_total"),
          filterBy("labels", "EQUALS_TO", 'type="all"'),
          groupBy(null, col("value"))),
        title: "Active Sessions",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_users_total"),
          groupBy(null, col("value"))),
        title: "Users",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_teams_total"),
          groupBy(null, col("value"))),
        title: "Teams",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_organizations_total"),
          groupBy(null, col("value"))),
        title: "Organizations",
      })
    ]
  ),

  // Resources section
  html(`<p style="\${subTitlesStyle}">Resources</p>`),

  columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_inventories_total"),
          groupBy(null, col("value"))),
        title: "Inventories",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_projects_total"),
          groupBy(null, col("value"))),
        title: "Projects",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_job_templates_total"),
          groupBy(null, col("value"))),
        title: "Job Templates",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_inventory_scripts_total"),
          groupBy(null, col("value"))),
        title: "Inventory Scripts",
      })
    ]
  ),

  // Misc section
  html(`<p style="\${subTitlesStyle}">Misc</p>`),

  columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_running_jobs_total"),
          groupBy(null, col("value"))),
        title: "Running Jobs",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_pending_jobs_total"),
          groupBy(null, col("value"))),
        title: "Pending Jobs",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_hosts_total"),
          filterBy("labels", "EQUALS_TO", 'type="all"'),
          groupBy(null, col("value"))),
        title: "All Hosts",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_hosts_total"),
          filterBy("labels", "EQUALS_TO", 'type="active"'),
          groupBy(null, col("value"))),
        title: "Active Hosts",
      })
    ]
  ),

  withStyle({ "margin-top": "20px" }, columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_schedules_total"),
          groupBy(null, col("value"))),
        title: "Schedules",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_custom_virtualenvs_total"),
          groupBy(null, col("value"))),
        title: "Virtual Envs",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_instance_capacity"),
          groupBy(null, col("value"))),
        title: "Instance Capacity",
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "awx_instance_remaining_capacity"),
          groupBy(null, col("value"))),
        title: "Remaining Capacity",
      })
    ]
  )),
  {
    properties: {
      token: "your token here",
      authorizationHeader: "Basic ${token}",
      towerUrl: "your tower url here",
      proxyUrl: "a proxy to make HTTP requests if CORS is not enabled",
      subTitlesStyle: "font-size: large; margin: 15px 0 10px 0",
    },
    datasets: [metricsDs],
  });
