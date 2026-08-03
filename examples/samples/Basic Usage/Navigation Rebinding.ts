import {
  page, bind, inlineSource,
  pills,
  tree,
  tabs,
  menu,
  sidebar,
  carousel,
  accordion,
  grid,
  at,
  html,
  metric,
  barChart,
  lineChart,
  pieChart,
  dataTable,
  lookup,
  groupBy,
  sum
} from "@casehubio/pages-ui";

import type { DataSetId, ColumnId } from "@casehubio/pages-data";
import { ColumnType } from "@casehubio/pages-data";

// TypeScript companion to "Navigation Rebinding.dash.yml"
// Same three-level content hierarchy, different navigation wrappers — switch pills to compare

const sales = "sales" as DataSetId;
const inventory = "inventory" as DataSetId;
const errors = "errors" as DataSetId;
const latency = "latency" as DataSetId;
const reportRuns = "report-runs" as DataSetId;

// Datasets
const salesDataset = bind("sales", inlineSource([
    ["North", "Q1", 45000, 52],
    ["North", "Q2", 48000, 55],
    ["South", "Q1", 38000, 45],
    ["South", "Q2", 41000, 48],
    ["East", "Q1", 51000, 60],
    ["East", "Q2", 54000, 63],
    ["West", "Q1", 42000, 49],
    ["West", "Q2", 45000, 52],
  ], {
    columns: [
      { id: "Region" as ColumnId, type: ColumnType.LABEL },
      { id: "Quarter" as ColumnId, type: ColumnType.LABEL },
      { id: "Revenue" as ColumnId, type: ColumnType.NUMBER },
      { id: "Orders" as ColumnId, type: ColumnType.NUMBER },
    ],
  }));

const inventoryDataset = bind("inventory", inlineSource([
    ["Laptops", 340, 400, 85],
    ["Monitors", 520, 600, 87],
    ["Keyboards", 780, 800, 98],
    ["Mice", 890, 900, 99],
    ["Headsets", 210, 300, 70],
  ], {
    columns: [
      { id: "Item" as ColumnId, type: ColumnType.LABEL },
      { id: "Stock" as ColumnId, type: ColumnType.NUMBER },
      { id: "Capacity" as ColumnId, type: ColumnType.NUMBER },
      { id: "Utilization" as ColumnId, type: ColumnType.NUMBER },
    ],
  }));

const errorsDataset = bind("errors", inlineSource([
    ["Login", 12],
    ["Payment", 8],
    ["Search", 5],
    ["Checkout", 15],
    ["Profile", 3],
  ], {
    columns: [
      { id: "Metric" as ColumnId, type: ColumnType.LABEL },
      { id: "Count" as ColumnId, type: ColumnType.NUMBER },
    ],
  }));

const latencyDataset = bind("latency", inlineSource([
    ["API Gateway", 45],
    ["Auth Service", 120],
    ["Database", 320],
    ["Cache", 5],
    ["CDN", 15],
  ], {
    columns: [
      { id: "Component" as ColumnId, type: ColumnType.LABEL },
      { id: "Latency" as ColumnId, type: ColumnType.NUMBER },
    ],
  }));

const reportRunsDataset = bind("report-runs", inlineSource([
    ["Sales Q2 Summary", "2026-06-21 08:00", "Completed", 2140],
    ["Ops Weekly Digest", "2026-06-20 23:00", "Completed", 4520],
    ["Revenue Forecast", "2026-06-20 18:30", "Completed", 8930],
    ["Inventory Alert", "2026-06-20 12:00", "Failed", 0],
    ["Customer Churn", "2026-06-19 09:00", "Completed", 5670],
    ["Pipeline Health", "2026-06-19 06:00", "Completed", 3100],
    ["Monthly KPIs", "2026-06-18 00:00", "Completed", 12400],
    ["SLA Compliance", "2026-06-17 23:00", "Completed", 6780],
  ], {
    columns: [
      { id: "Report" as ColumnId, type: ColumnType.LABEL },
      { id: "RunTime" as ColumnId, type: ColumnType.LABEL },
      { id: "Status" as ColumnId, type: ColumnType.LABEL },
      { id: "Duration" as ColumnId, type: ColumnType.NUMBER },
    ],
  }));

// Shared content pages (three-level hierarchy)
const dashboardPage = page("Dashboard",
  metric({
    title: "Total Revenue",
    columns: [{ id: "Total" as ColumnId, pattern: "$#,##0" }],
    lookup: lookup(sales, groupBy(null, sum("Revenue"))),
  }),
  metric({
    title: "Total Orders",
    columns: [{ id: "Total" as ColumnId, pattern: "#,##0" }],
    lookup: lookup(sales, groupBy(null, sum("Orders"))),
  }),
  barChart({
    title: "Revenue by Region",
    lookup: lookup(sales),
    resizable: true,
    height: "300",
  }),
);

const inventoryPage = page("Inventory",
  dataTable({
    lookup: lookup(inventory),
  }),
);

const reportsPage = page("Reports",
  dataTable({
    lookup: lookup(reportRuns),
  }),
  page("Errors",
    pieChart({
      title: "Error Distribution",
      lookup: lookup(errors),
      resizable: true,
      height: "300",
    }),
  ),
  page("Performance",
    lineChart({
      title: "Latency by Component",
      lookup: lookup(latency),
      resizable: true,
      height: "300",
    }),
  ),
);

// Navigation variants
const treeView = page("Tree View",
  tree(
    ["Dashboard", dashboardPage],
    ["Inventory", inventoryPage],
    ["Reports", reportsPage],
  ),
);

const tabsView = page("Tabs View",
  tabs(
    ["Dashboard", dashboardPage],
    ["Inventory", inventoryPage],
    ["Reports", reportsPage],
  ),
);

const menuView = page("Menu View",
  menu(
    ["Dashboard", dashboardPage],
    ["Inventory", inventoryPage],
    ["Reports", reportsPage],
  ),
);

const sidebarView = page("Sidebar View",
  sidebar(
    ["Dashboard", dashboardPage],
    ["Inventory", inventoryPage],
    ["Reports", reportsPage],
  ),
);

const gridView = page("Grid View",
  grid(3,
    at(0, 0, 1, 1, dashboardPage),
    at(1, 0, 1, 1, inventoryPage),
    at(2, 0, 1, 1, reportsPage),
  ),
);

const carouselView = page("Carousel View",
  carousel(
    ["Dashboard", dashboardPage],
    ["Inventory", inventoryPage],
    ["Reports", reportsPage],
  ),
);

const accordionView = page("Accordion View",
  accordion(
    ["Dashboard", dashboardPage],
    ["Inventory", inventoryPage],
    ["Reports", reportsPage],
  ),
);

// Top-level selector
export default page("Navigation Rebinding",
  html(
    `<div style="padding: 12px 20px; background: linear-gradient(135deg, #1a1a2e, #16213e); color: #e0e0e0; margin-bottom: 16px; border-radius: 8px">
      <strong style="font-size: 1.3em">Navigation Rebinding</strong>
      <span style="margin-left: 12px; opacity: 0.7">Same three-level content hierarchy, different navigation wrappers — switch pills to compare</span>
    </div>`
  ),
  pills(
    ["Tree View", treeView],
    ["Tabs View", tabsView],
    ["Menu View", menuView],
    ["Sidebar View", sidebarView],
    ["Grid View", gridView],
    ["Carousel View", carouselView],
    ["Accordion View", accordionView],
  ),
  {
    datasets: [salesDataset, inventoryDataset, errorsDataset, latencyDataset, reportRunsDataset],
  },
);
