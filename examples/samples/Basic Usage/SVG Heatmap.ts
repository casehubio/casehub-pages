// @ts-nocheck
import { page, bind, inlineSource, iframePlugin, lookup} from "@casehubio/pages-ui";

// Dataset
const svgData = [
  ["svg_1", 1],
  ["svg_2", 2],
  ["svg_3", 3],
  ["svg_4", 4],
  ["svg_5", 5],
  ["svg_6", 6]
];

const svgDataDs = bind("svg-data", inlineSource(svgData, {
  columns: [
    { id: "id", type: "LABEL" },
    { id: "v", type: "NUMBER" }
  ]
}));

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg">
  <path id="svg_1" d="m23,23l82,0l0,51l-82,0l0,-51z" stroke-width="0" fill="#999999"/>
  <path id="svg_2" d="m133,23l82,0l0,51l-82,0l0,-51z" stroke-width="0" fill="#999999"/>
  <path id="svg_3" d="m240,23l82,0l0,51l-82,0l0,-51z" stroke-width="0" fill="#999999"/>
  <path id="svg_4" d="m350,23l82,0l0,51l-82,0l0,-51z" stroke-width="0" fill="#999999"/>
  <path id="svg_5" d="m461,24l82,0l0,51l-82,0l0,-51z" stroke-width="0" fill="#999999"/>
  <path id="svg_6" d="m566,26l82,0l0,51l-82,0l0,-51z" stroke-width="0" fill="#999999"/>
</svg>`;

export default page(
  "SVG Heatmap",
  iframePlugin({
    componentId: "svg-heatmap",
    width: "100%",
    properties: {
      "svg-heatmap.svg": svgContent
    },
    lookup: lookup("svg-data", )
  }),
  { datasets: [svgDataDs] });
