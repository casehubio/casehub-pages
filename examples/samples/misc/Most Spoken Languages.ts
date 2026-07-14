import { page, bind, inlineSource, html, barChart, table, lookup} from "@casehubio/pages-ui";

import type { DataSetId, ColumnId } from "@casehubio/pages-data";

// TypeScript companion to "Most Spoken Languages.dash.yaml"
// Simple inline dataset example

const langsDs = bind("langs", inlineSource([;

export default page(
  {},
  {},
  [
      ["English", "Hello World", 1132],
      ["Mandarin", "你好世界", 1117],
      ["Hindi", "नमस्ते दुनिया", 615],
      ["Spanish", "Hola Mundo", 534],
      ["French", "Bonjour le monde", 280]
    ], {})),
  ],
  [
    html(`<p style="font-size: xx-large; margin-bottom: 30px"> Most spoken languages</p><hr style=""/>`),

    barChart({
      lookup: lookup("langs" as DataSetId, {
          type: "group",
          groupingKey: { sourceId: "Column 0" as ColumnId },
          functions: [
            { source: "Column 0" as ColumnId },
            { source: "Column 2" as ColumnId }
          ]
        }),
      chart: { resizable: true },
    }),

    table({
      lookup: lookup("langs" as DataSetId, ),
      chart: { resizable: true },
    })
  ],
  { datasets: [langsDs] });
