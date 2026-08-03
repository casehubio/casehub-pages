import { page, bind, restSource, html, metric, lineChart, barChart, bubbleChart, dataTable, lookup, groupBy, sortBy, col, sum, avg, count, withStyle, columns } from "@casehubio/pages-ui";
import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";

const fifaMatchesDs = bind("fifa_matches", restSource("https://api.fifa.com/api/v3/calendar/matches?from=2022-11-20T00%3A00%3A00Z&to=2022-12-20T23%3A59%3A59Z&language=en&count=500&idSeason=255711", dataSetId("fifa_matches"), {
  cacheEnabled: true,
  expression: `$.Results.[ ( $.MatchStatus = 0 ? [$.IdMatch, $.LocalDate = null ? "" : $.LocalDate, $toMillis($.LocalDate) ~>  $fromMillis('[D]-[M]-[Y]'), $toMillis($.LocalDate) ~>  $fromMillis('[H]:[m]'), $.Weather.Humidity != null ? $.Weather.Humidity : "-1", $.Weather.Temperature != null ? $.Weather.Temperature : "-1", $.Weather.WindSpeed != null ? $.Weather.WindSpeed :  "-1", $.Weather.TypeLocalized[0].Description != null ? $.Weather.TypeLocalized[0].Description :  "", $.Home.IdCountry != null ? $.Home.IdCountry : "", $.Home.ShortClubName != null ? $.Home.ShortClubName : "", $.HomeTeamScore != null ? $.HomeTeamScore : "-1", $.Away.IdCountry != null ? $.Away.IdCountry : "", $.Away.ShortClubName != null ? $.Away.ShortClubName : "", $.Away.Score != null ? $.Away.Score : "-1", $.Stadium.Name[0].Description, $.Stadium.CityName[0].Description, $.Attendance != null ? $.Attendance :  "-1", $.HomeTeamScore + $.AwayTeamScore, $join([$.Home.ShortClubName, $.Away.ShortClubName], ' vs ')] ) ]`,
  columns: [
    { id: "ID" as ColumnId, type: ColumnType.LABEL },
    { id: "Date" as ColumnId, type: ColumnType.LABEL },
    { id: "Day" as ColumnId, type: ColumnType.LABEL },
    { id: "Hour" as ColumnId, type: ColumnType.LABEL },
    { id: "Humidity" as ColumnId, type: ColumnType.NUMBER },
    { id: "Temperature" as ColumnId, type: ColumnType.NUMBER },
    { id: "WindSpeed" as ColumnId, type: ColumnType.NUMBER },
    { id: "Weather" as ColumnId, type: ColumnType.LABEL },
    { id: "Team 1 Country" as ColumnId, type: ColumnType.LABEL },
    { id: "Team 1 Name" as ColumnId, type: ColumnType.LABEL },
    { id: "Team 1 Score" as ColumnId, type: ColumnType.NUMBER },
    { id: "Team 2 Country" as ColumnId, type: ColumnType.LABEL },
    { id: "Team 2 Name" as ColumnId, type: ColumnType.LABEL },
    { id: "Team 2 Score" as ColumnId, type: ColumnType.NUMBER },
    { id: "Stadium Name" as ColumnId, type: ColumnType.LABEL },
    { id: "Stadium Location Name" as ColumnId, type: ColumnType.LABEL },
    { id: "Attendance" as ColumnId, type: ColumnType.NUMBER },
    { id: "Total Goals" as ColumnId, type: ColumnType.NUMBER },
    { id: "Match Name" as ColumnId, type: ColumnType.LABEL },
  ],
}));

export default page("FIFA 2022 Goals",
  html(`<p><p style="font-size: xx-large">FIFA World Cup Qatar 2022™</p><small>Goals Score Statistics</small><hr /></p>`),

  withStyle({ "margin-bottom": "100px", "margin-top": "50px" }, columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("fifa_matches", groupBy(null, sum("Total Goals"))),
        title: "Total Goals",
        columns: [{ id: "Total Goals" as ColumnId, pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("fifa_matches", groupBy(null, avg("Total Goals"))),
        title: "Average Goals by Match",
      }),
    ],
    [
      metric({
        lookup: lookup("fifa_matches", groupBy(null, avg("Temperature"))),
        title: "Average Temperature",
      }),
    ],
    [
      metric({
        lookup: lookup("fifa_matches", groupBy(null, avg("Attendance"))),
        title: "Average Attendance",
      }),
    ]
  )),

  columns([6, 6], [
      lineChart({
        lookup: lookup("fifa_matches", groupBy("Day", col("Day"), { kind: "aggregate" as const, sourceId: "Total Goals" as ColumnId, columnId: "Goals" as ColumnId, fn: { fn: "SUM" as const } })),
        title: "Goals by Day",
        xAxis: { labelAngle: 30 },
        yAxis: { title: "AVG Goals" },
        resizable: true, height: "300",
      }),
    ],
    [
      barChart({
        lookup: lookup("fifa_matches", sortBy("Goals", "DESCENDING"), groupBy("Stadium Name", col("Stadium Name"), { kind: "aggregate" as const, sourceId: "Total Goals" as ColumnId, columnId: "Goals" as ColumnId, fn: { fn: "SUM" as const } })),
        title: "Goals by Stadium",
        xAxis: { labelAngle: 15 },
        yAxis: { title: "AVG Goals" },
        resizable: true, height: "300",
      }),
    ]),

  withStyle({ "margin-top": "20px" }, columns([6, 6],
    [
      bubbleChart({
        lookup: lookup("fifa_matches", sortBy("TOTAL MATCHES", "ASCENDING"), groupBy("Weather", col("Weather"), { kind: "aggregate" as const, sourceId: "Total Goals" as ColumnId, columnId: "Goals" as ColumnId, fn: { fn: "SUM" as const } }, count("Weather", "TOTAL MATCHES"), count("Weather", "TOTAL MATCHES"))),
        title: "Goals by Weather",
        resizable: true, height: "300",
      }),
    ],
    [
      bubbleChart({
        lookup: lookup("fifa_matches", groupBy("Match Name", col("Match Name"), col("Attendance", "Attendance"), col("Total Goals", "Goals"), col("Total Goals", "Goals"))),
        title: "Goals by Attendance",
        zoom: true, resizable: true, height: "300",
        xAxis: { showLabels: false },
        yAxis: { title: "Attendance" },
      }),
    ]
  )),

  html(`<hr style="width: 2px; border: dashed 1px" /><p style="margin: 1px 10px 30px 10px; font-size: x-large"><strong>All Matches</strong></p>`),

  dataTable({
    lookup: lookup("fifa_matches", groupBy(null, col("Temperature"), col("ID"), col("Date"), col("Team 1 Score"), col("Match Name"), col("Team 2 Score"), col("Weather"), col("Stadium Name"), col("Attendance"))),
    resizable: true,
    columns: [
      { id: "Date" as ColumnId, expression: `new Date(value).toLocaleDateString() + " " + new Date(value).toLocaleTimeString()` },
      { id: "Team 1 Score" as ColumnId, pattern: "#" },
      { id: "Team 2 Score" as ColumnId, pattern: "#" },
    ],
  }),
  { properties: { GoalsFunction: "AVERAGE", SeriesColor: "cyan" }, datasets: [fifaMatchesDs] }
);
