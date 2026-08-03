import {
  page, bind, inlineSource,
  html,
  dataTable,
  metric,
  withAccess,
  rows,
  columns,
  lookup,
  groupBy,
  col,
  join,
  count,
} from "@casehubio/pages-ui";

import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType } from "@casehubio/pages-data";

const teamData = [
  ["Platform", "Alice Johnson", "Tech Lead", "alice@example.com", "Engineering"],
  ["Platform", "Bob Smith", "Senior Developer", "bob@example.com", "Engineering"],
  ["Platform", "Charlie Brown", "Developer", "charlie@example.com", "Engineering"],
  ["Platform", "Diana Ross", "QA Engineer", "diana@example.com", "Quality"],
  ["Data", "Eve Wilson", "Team Lead", "eve@example.com", "Engineering"],
  ["Data", "Frank Miller", "Data Engineer", "frank@example.com", "Engineering"],
  ["Data", "Grace Lee", "Analytics Engineer", "grace@example.com", "Engineering"],
  ["Data", "Henry Davis", "ML Engineer", "henry@example.com", "Research"],
  ["Frontend", "Iris Chen", "Team Lead", "iris@example.com", "Engineering"],
  ["Frontend", "Jack Taylor", "Senior Frontend Dev", "jack@example.com", "Engineering"],
  ["Frontend", "Karen White", "Frontend Developer", "karen@example.com", "Engineering"],
  ["Frontend", "Leo Martinez", "UX Engineer", "leo@example.com", "Design"],
];

const teamMembersDs = bind("team_members", inlineSource(teamData, {
  columns: [
    { id: "Team" as ColumnId, type: ColumnType.LABEL },
    { id: "Member" as ColumnId, type: ColumnType.LABEL },
    { id: "Role" as ColumnId, type: ColumnType.LABEL },
    { id: "Email" as ColumnId, type: ColumnType.LABEL },
    { id: "Department" as ColumnId, type: ColumnType.LABEL },
  ],
}));

// Overview page - visible to all
const overviewPage = page(
  "Overview",
  rows(
    columns([12], [
      html(`<div style="padding: 12px 20px; background: linear-gradient(135deg, #1e3a8a, #1e40af); color: #e0e0e0; margin-bottom: 16px; border-radius: 8px">
  <strong style="font-size: 1.3em">Team Management</strong>
  <span style="margin-left: 12px; opacity: 0.7">Organization overview and team details</span>
</div>`),
    ]),
    columns([12], [
      dataTable({
        title: "Teams Overview",
        pageSize: 10,
        sortable: true,
        lookup: lookup(
          "team_members", groupBy("Team", col("Team"), join("Member", ", "), count("Member")),),
      }),
    ]),
  ),
);

// Team Detail page - shows all members
const teamDetailPage = page(
  "Team Detail",
  rows(
    columns([12], [
      html(`<div style="padding: 4px 0 12px; color: #6b7280; font-size: 12px">
  ↳ Team Detail (inline TypeScript equivalent)
</div>`),
    ]),
    columns([12], [
      dataTable({
        title: "All Team Members",
        pageSize: 15,
        sortable: true,
        lookup: lookup("team_members"),
      }),
    ]),
  ),
);

// Admin Settings page - access-gated
const adminSettingsPage = page(
  "Admin Settings",
  rows(
    columns([12], [
      html(`<div style="padding: 4px 0 12px; color: #6b7280; font-size: 12px">
  ↳ Admin Settings (inline TypeScript equivalent) — Admin access required
</div>`),
    ]),
    columns([4, 4, 4], [
        metric({
          title: "Total Teams",
          columns: [{ id: "Count" as ColumnId, pattern: "#,##0" }],
          lookup: lookup("team_members", groupBy(null, count("Team"))),
        }),
        metric({
          title: "Total Members",
          columns: [{ id: "Count" as ColumnId, pattern: "#,##0" }],
          lookup: lookup("team_members", groupBy(null, count("Member"))),
        }),
        metric({
          title: "Departments",
          columns: [{ id: "Count" as ColumnId, pattern: "#,##0" }],
          lookup: lookup("team_members", groupBy(null, count("Department"))),
        }),
      ],
    ),
  ),
);

export default page(
  "Team Management",
  overviewPage,
  teamDetailPage,
  withAccess({ roles: ["admin"] }, adminSettingsPage),
  { datasets: [teamMembersDs] }
);
