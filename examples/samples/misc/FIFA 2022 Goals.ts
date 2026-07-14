// @ts-nocheck
import { page, bind, restSource, html, metric, lineChart, barChart, bubbleChart, table, columns, lookup } from "@casehubio/pages-ui";

const fifaMatchesDs = bind("fifa_matches", restSource("https://api.fifa.com/api/v3/calendar/matches?from=2022-11-20T00%3A00%3A00Z&to=2022-12-20T23%3A59%3A59Z&language=en&count=500&idSeason=255711", {
  cacheEnabled: true,
  expression: `$.Results.[ ( $.MatchStatus = 0 ? [$.IdMatch, $.LocalDate = null ? "" : $.LocalDate, $toMillis($.LocalDate) ~>  $fromMillis('[D]-[M]-[Y]'), $toMillis($.LocalDate) ~>  $fromMillis('[H]:[m]'), $.Weather.Humidity != null ? $.Weather.Humidity : "-1", $.Weather.Temperature != null ? $.Weather.Temperature : "-1", $.Weather.WindSpeed != null ? $.Weather.WindSpeed :  "-1", $.Weather.TypeLocalized[0].Description != null ? $.Weather.TypeLocalized[0].Description :  "", $.Home.IdCountry != null ? $.Home.IdCountry : "", $.Home.ShortClubName != null ? $.Home.ShortClubName : "", $.HomeTeamScore != null ? $.HomeTeamScore : "-1", $.Away.IdCountry != null ? $.Away.IdCountry : "", $.Away.ShortClubName != null ? $.Away.ShortClubName : "", $.Away.Score != null ? $.Away.Score : "-1", $.Stadium.Name[0].Description, $.Stadium.CityName[0].Description, $.Attendance != null ? $.Attendance :  "-1", $.HomeTeamScore + $.AwayTeamScore, $join([$.Home.ShortClubName, $.Away.ShortClubName], ' vs ')] ) ]`,
  columns: [
    { id: "ID", type: "LABEL" },
    { id: "Date", type: "LABEL" },
    { id: "Day", type: "LABEL" },
    { id: "Hour", type: "LABEL" },
    { id: "Humidity", type: "NUMBER" },
    { id: "Temperature", type: "NUMBER" },
    { id: "WindSpeed", type: "NUMBER" },
    { id: "Weather", type: "LABEL" },
    { id: "Team 1 Country", type: "LABEL" },
    { id: "Team 1 Name", type: "LABEL" },
    { id: "Team 1 Score", type: "NUMBER" },
    { id: "Team 2 Country", type: "LABEL" },
    { id: "Team 2 Name", type: "LABEL" },
    { id: "Team 2 Score", type: "NUMBER" },
    { id: "Stadium Name", type: "LABEL" },
    { id: "Stadium Location Name", type: "LABEL" },
    { id: "Attendance", type: "NUMBER" },
    { id: "Total Goals", type: "NUMBER" },
    { id: "Match Name", type: "LABEL" },
  ],
}));

export default page("FIFA 2022 Goals",
  html(`<p><p style="font-size: xx-large">FIFA World Cup Qatar 2022™</p><small>Goals Score Statistics</small><hr /></p>`),

  columns({ "margin-bottom": "100px", "margin-top": "50px" }, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("fifa_matches", { type: "group", functions: [{ source: "Total Goals", function: "SUM" }] }),
        general: { title: "Total Goals" },
        columns: [{ id: "Total Goals", pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("fifa_matches", { type: "group", functions: [{ source: "Total Goals", function: "AVERAGE" }] }),
        general: { title: "Average Goals by Match" },
      }),
    ],
    [
      metric({
        lookup: lookup("fifa_matches", { type: "group", functions: [{ source: "Temperature", function: "AVERAGE" }] }),
        general: { title: "Average Temperature" },
      }),
    ],
    [
      metric({
        lookup: lookup("fifa_matches", { type: "group", functions: [{ source: "Attendance", function: "AVERAGE" }] }),
        general: { title: "Average Attendance" },
      }),
    ]
  ),

  columns({}, ["6", "6"],
    [
      lineChart({
        lookup: lookup("fifa_matches", {
          type: "group",
          groupingKey: { sourceId: "Day" },
          functions: [
            { source: "Day" },
            { source: "Total Goals", column: "Goals", function: "${GoalsFunction}" },
          ],
        }),
        general: { title: "Goals by Day" },
        axis: { x: { labels_angle: 30 }, y: { title: "AVG Goals" } },
        chart: { resizable: true, height: 300 },
      }),
    ],
    [
      barChart({
        lookup: lookup("fifa_matches", { type: "sort", column: "Goals", order: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "Stadium Name" },
            functions: [
              { source: "Stadium Name" },
              { source: "Total Goals", function: "${GoalsFunction}", column: "Goals" },
            ],
          }),
        general: { title: "Goals by Stadium" },
        axis: { x: { labels_angle: 15 }, y: { title: "AVG Goals" } },
        chart: { resizable: true, height: 300 },
      }),
    ]
  ),

  columns({ "margin-top": "20px" }, ["6", "6"],
    [
      bubbleChart({
        lookup: lookup("fifa_matches", { type: "sort", column: "TOTAL MATCHES", order: "ASCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "Weather" },
            functions: [
              { source: "Weather" },
              { source: "Total Goals", function: "${GoalsFunction}", column: "Goals" },
              { source: "Weather", function: "COUNT", column: "TOTAL MATCHES" },
              { source: "Weather", function: "COUNT", column: "TOTAL MATCHES" },
            ],
          }),
        general: { title: "Goals by Weather", subtitle: "Bubble shows total matches" },
        chart: { resizable: true, height: 300 },
      }),
    ],
    [
      bubbleChart({
        lookup: lookup("fifa_matches", {
          type: "group",
          groupingKey: { sourceId: "Match Name" },
          functions: [
            { source: "Match Name" },
            { source: "Attendance", column: "Attendance" },
            { source: "Total Goals", column: "Goals" },
            { source: "Total Goals", column: "Goals" },
          ],
        }),
        general: { title: "Goals by Attendance", subtitle: "Bubble shows total goals" },
        chart: { zoom: true, resizable: true, height: 300 },
        axis: { x: { labels_show: false }, y: { title: "Attendance" } },
      }),
    ]
  ),

  html(`<hr style="width: 2px; border: dashed 1px" /><p style="margin: 1px 10px 30px 10px; font-size: x-large"><strong>All Matches</strong></p>`),

  table({
    lookup: lookup("fifa_matches", {
      type: "group",
      functions: [
        { source: "Temperature" },
        { source: "ID" },
        { source: "Date" },
        { source: "Team 1 Score" },
        { source: "Match Name" },
        { source: "Team 2 Score" },
        { source: "Weather" },
        { source: "Stadium Name" },
        { source: "Attendance" },
      ],
    }),
    chart: { resizable: true },
    columns: [
      { id: "Date", expression: `new Date(value).toLocaleDateString() + " " + new Date(value).toLocaleTimeString()` },
      { id: "Team 1 Score", pattern: "#" },
      { id: "Team 2 Score", pattern: "#" },
    ],
  }),
  { properties: { GoalsFunction: "AVERAGE", SeriesColor: "cyan" }, datasets: [fifaMatchesDs] }
);
