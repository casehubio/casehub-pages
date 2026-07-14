import { page, bind, inlineSource, barChart, pieChart, meter, html, withStyle, columns, rows, lookup} from "@casehubio/pages-ui";

const aDs = bind("a", inlineSource([
  ["A", 1],
  ["B", 2],
  ["C", 3]
]));

export default page(
  "Column with rows",
  rows(
    columns(
      [6],
      [
        withStyle(
          { border: "solid 1px" },
          barChart({
            height: 300,
            resizable: true,
            lookup: lookup("a", )
          })
        )
      ],
      [6],
      [
        rows(
          withStyle(
            { border: "solid 1px", margin: "1px" },
            columns(
              [12],
              [
                pieChart({
                  height: 150,
                  resizable: true,
                  lookup: lookup("a", )
                })
              ]
            )
          ),
          withStyle(
            { border: "solid 1px", margin: "1px" },
            columns(
              [12],
              [
                meter({
                  height: 150,
                  resizable: true,
                  lookup: lookup("a", )
                })
              ]
            )
          )
        )
      ]
    ),
    withStyle(
      { border: "solid blue" },
      columns(
        [12],
        [html("ROW 2")]
      )
    )
  ),
  { datasets: [aDs] });
