// @ts-nocheck
import { page, bind, restSource, html, metric, columns, lookup } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("data/metrics", {
  cacheEnabled: true,
  refreshTime: "1minute",
  columns: [
    { id: "metric", type: "LABEL" },
    { id: "labels", type: "LABEL" },
    { id: "Value", type: "Number" },
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

  columns({}, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_sessions_total"] },
          { type: "filter", column: "labels", function: "EQUALS_TO", args: ['type="all"'] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Active Sessions" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_users_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Users" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_teams_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Teams" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_organizations_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Organizations" },
      })
    ]
  ),

  // Resources section
  html(`<p style="\${subTitlesStyle}">Resources</p>`),

  columns({}, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_inventories_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Inventories" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_projects_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Projects" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_job_templates_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Job Templates" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_inventory_scripts_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Inventory Scripts" },
      })
    ]
  ),

  // Misc section
  html(`<p style="\${subTitlesStyle}">Misc</p>`),

  columns({}, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_running_jobs_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Running Jobs" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_pending_jobs_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Pending Jobs" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_hosts_total"] },
          { type: "filter", column: "labels", function: "EQUALS_TO", args: ['type="all"'] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "All Hosts" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_hosts_total"] },
          { type: "filter", column: "labels", function: "EQUALS_TO", args: ['type="active"'] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Active Hosts" },
      })
    ]
  ),

  columns({ "margin-top": "20px" }, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_schedules_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Schedules" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_custom_virtualenvs_total"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Virtual Envs" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_instance_capacity"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Instance Capacity" },
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["awx_instance_remaining_capacity"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Remaining Capacity" },
      })
    ]
  ),
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
