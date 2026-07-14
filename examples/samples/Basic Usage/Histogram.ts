import { page, bind, inlineSource, barChart, table, lookup} from "@casehubio/pages-ui";

const histogramExpression = `
(
  $n := 1 + $count($) ~> $sqrt ~> $floor;
  $s := $max($) / $n;
  $t := $;
  [0..$n].(
    $lt := $s * $;
    $gt := ($ + 1) * $s;
    [[ $lt & "-" & $gt, $map($t, function($v) { $v >= $lt and $v < $gt ? 1 : 0}) ~> $sum]]
  )
)
`;

const rawData = [
  5, 6, 7, 10, 3, 5, 11, 20, 6, 10, 5, 17,
  13, 22, 13, 50, 2, 4, 6, 10, 12, 5, 8, 10
];

const histogramDs = bind("histogram", inlineSource(rawData, {
  expression: histogramExpression
}));

const extraConfig = {
  series: {
    barCategoryGap: "1%"
  }
};

export default page(
  "Histogram",
  barChart({
    extraConfiguration: JSON.stringify(extraConfig),
    lookup: lookup("histogram", )
  }),
  table({
    lookup: lookup("histogram", )
  }),
  { datasets: [histogramDs] });
