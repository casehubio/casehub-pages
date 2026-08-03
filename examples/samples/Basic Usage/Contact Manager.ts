import {
  page, bind, inlineSource, title, dataTable, textInput, numberInput,
  dropdown, checkbox, datePicker, textarea, lookup,
} from "@casehubio/pages-ui";
import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType } from "@casehubio/pages-data";

import type { DataSetId } from "@casehubio/pages-data";

const contacts = "contacts" as DataSetId;

const dataset = bind("contacts", inlineSource([
    [1, "Alice Johnson", "alice@example.com", "+1-555-0101", "Work", "true", "2024-03-15", "Key client contact", 1],
    [2, "Bob Smith", "bob@example.com", "+1-555-0102", "Personal", "true", "2023-11-20", "", 2],
    [3, "Carol Davis", "carol@example.com", "+1-555-0103", "Work", "false", "2025-01-08", "On leave until March", 3],
  ], {
    columns: [
      { id: "id" as ColumnId, type: ColumnType.NUMBER },
      { id: "name" as ColumnId, type: ColumnType.TEXT },
      { id: "email" as ColumnId, type: ColumnType.TEXT },
      { id: "phone" as ColumnId, type: ColumnType.TEXT },
      { id: "category" as ColumnId, type: ColumnType.LABEL },
      { id: "active" as ColumnId, type: ColumnType.LABEL },
      { id: "startDate" as ColumnId, type: ColumnType.DATE },
      { id: "notes" as ColumnId, type: ColumnType.TEXT },
      { id: "priority" as ColumnId, type: ColumnType.NUMBER },
    ],
  }));

export default page("Contact List",
  title("Contact Manager"),
  dataTable({
    pageSize: 10,
    sortable: true,
    filter: { enabled: true, notification: true },
    lookup: lookup(contacts),
  }),
  page("Contact Form",
    textInput({ field: "name", label: "Full Name", required: true }),
    textInput({ field: "email", label: "Email", required: true }),
    textInput({ field: "phone", label: "Phone" }),
    numberInput({ field: "priority", label: "Priority", min: 1, max: 5 }),
    dropdown({
      field: "category", label: "Category",
      options: { values: ["Work", "Personal", "Family", "Other"] },
    }),
    checkbox({ field: "active", label: "Active" }),
    datePicker({ field: "startDate", label: "Start Date" }),
    textarea({ field: "notes", label: "Notes", rows: 3 }),
    {
      dataScope: { dataset: contacts, idColumn: "id" },
      save: { trigger: "auto", delay: 2000, adapter: "local" },
    },
  ),
  { datasets: [dataset] },
);
