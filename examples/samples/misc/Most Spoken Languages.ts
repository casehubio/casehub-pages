import { page, bind, inlineSource, html, barChart, dataTable, lookup, groupBy, col } from "@casehubio/pages-ui";
import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType } from "@casehubio/pages-data";

const langsDs = bind("langs", inlineSource([
  ["English", "Hello World", 1132],
  ["Mandarin", "你好世界", 1117],
  ["Hindi", "नमस्ते दुनिया", 615],
  ["Spanish", "Hola Mundo", 534],
  ["French", "Bonjour le monde", 280],
], {
  columns: [
    { id: "Language" as ColumnId, type: ColumnType.LABEL },
    { id: "Greeting" as ColumnId, type: ColumnType.LABEL },
    { id: "Speakers" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("Most Spoken Languages",
  html(`<p style="font-size: xx-large; margin-bottom: 30px"> Most spoken languages</p><hr style=""/>`),
  barChart({
    lookup: lookup("langs", groupBy("Language", col("Language"), col("Speakers"))),
    resizable: true,
  }),
  dataTable({
    lookup: lookup("langs"),
    resizable: true,
  }),
  { datasets: [langsDs] },
);
