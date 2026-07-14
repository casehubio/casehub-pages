// @ts-nocheck
import { page, bind, inlineSource, html, barChart, table, lookup, groupBy, col } from "@casehubio/pages-ui";

const langsDs = bind("langs", inlineSource([
  ["English", "Hello World", 1132],
  ["Mandarin", "你好世界", 1117],
  ["Hindi", "नमस्ते दुनिया", 615],
  ["Spanish", "Hola Mundo", 534],
  ["French", "Bonjour le monde", 280],
], {
  columns: [
    { id: "Language", type: "LABEL" },
    { id: "Greeting", type: "LABEL" },
    { id: "Speakers", type: "NUMBER" },
  ],
}));

export default page("Most Spoken Languages",
  html(`<p style="font-size: xx-large; margin-bottom: 30px"> Most spoken languages</p><hr style=""/>`),
  barChart({
    lookup: lookup("langs", groupBy("Language", col("Language"), col("Speakers"))),
    chart: { resizable: true },
  }),
  table({
    lookup: lookup("langs"),
    chart: { resizable: true },
  }),
  { datasets: [langsDs] }
);
