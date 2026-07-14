// @ts-nocheck
import {
  page, bind, inlineSource,
  sidebar,
  columns,
  metric,
  barChart,
  pieChart,
  lineChart,
  areaChart,
  timeseries,
  selector,
  table,
  meter,
  lookup,
  groupBy,
  filterBy,
  col,
  avg,
  count,
} from "@casehubio/pages-ui";

const sensorDataset = bind("sensor_readings", inlineSource([
    ["2026-06-25T00:00", "DEV-001", "Warehouse A", 21.3, 45, 1013, 98, "Online"],
    ["2026-06-25T01:00", "DEV-001", "Warehouse A", 21.1, 46, 1013, 97, "Online"],
    ["2026-06-25T02:00", "DEV-001", "Warehouse A", 20.8, 47, 1014, 96, "Online"],
    ["2026-06-25T03:00", "DEV-001", "Warehouse A", 20.5, 48, 1014, 95, "Online"],
    ["2026-06-25T04:00", "DEV-001", "Warehouse A", 20.9, 46, 1013, 94, "Online"],
    ["2026-06-25T00:00", "DEV-002", "Warehouse B", 22.5, 42, 1012, 85, "Online"],
    ["2026-06-25T01:00", "DEV-002", "Warehouse B", 22.8, 43, 1012, 84, "Online"],
    ["2026-06-25T02:00", "DEV-002", "Warehouse B", 23.1, 44, 1013, 83, "Online"],
    ["2026-06-25T03:00", "DEV-002", "Warehouse B", 23.4, 45, 1013, 82, "Online"],
    ["2026-06-25T04:00", "DEV-002", "Warehouse B", 23.0, 43, 1012, 81, "Online"],
    ["2026-06-25T00:00", "DEV-003", "Factory Floor", 28.2, 55, 1011, 72, "Warning"],
    ["2026-06-25T01:00", "DEV-003", "Factory Floor", 29.5, 57, 1010, 70, "Warning"],
    ["2026-06-25T02:00", "DEV-003", "Factory Floor", 31.0, 60, 1010, 68, "Warning"],
    ["2026-06-25T03:00", "DEV-003", "Factory Floor", 32.5, 62, 1009, 65, "Warning"],
    ["2026-06-25T04:00", "DEV-003", "Factory Floor", 30.8, 58, 1010, 63, "Warning"],
    ["2026-06-25T00:00", "DEV-004", "Cold Storage", -18.2, 30, 1015, 55, "Online"],
    ["2026-06-25T01:00", "DEV-004", "Cold Storage", -17.8, 31, 1015, 53, "Online"],
    ["2026-06-25T02:00", "DEV-004", "Cold Storage", -17.5, 32, 1016, 51, "Online"],
    ["2026-06-25T03:00", "DEV-004", "Cold Storage", -18.0, 30, 1015, 49, "Online"],
    ["2026-06-25T04:00", "DEV-004", "Cold Storage", -18.5, 29, 1015, 47, "Online"],
    ["2026-06-25T00:00", "DEV-005", "Loading Dock", 25.0, 65, 1012, 30, "Online"],
    ["2026-06-25T01:00", "DEV-005", "Loading Dock", 24.5, 67, 1012, 28, "Online"],
    ["2026-06-25T02:00", "DEV-005", "Loading Dock", 23.8, 70, 1013, 25, "Online"],
    ["2026-06-25T03:00", "DEV-005", "Loading Dock", 23.2, 72, 1013, 22, "Online"],
    ["2026-06-25T04:00", "DEV-005", "Loading Dock", 24.0, 68, 1012, 19, "Online"],
    ["2026-06-25T00:00", "DEV-006", "Server Room", 22.0, 38, 1014, 15, "Offline"],
    ["2026-06-25T01:00", "DEV-006", "Server Room", 22.3, 39, 1014, 12, "Offline"],
    ["2026-06-25T02:00", "DEV-006", "Server Room", 22.5, 40, 1013, 10, "Offline"],
    ["2026-06-25T03:00", "DEV-006", "Server Room", 22.8, 41, 1013, 8, "Offline"],
    ["2026-06-25T04:00", "DEV-006", "Server Room", 23.0, 42, 1013, 5, "Offline"],
    ["2026-06-25T05:00", "DEV-001", "Warehouse A", 21.5, 44, 1013, 93, "Online"],
    ["2026-06-25T06:00", "DEV-001", "Warehouse A", 22.0, 43, 1012, 92, "Online"],
    ["2026-06-25T05:00", "DEV-002", "Warehouse B", 23.5, 44, 1012, 80, "Online"],
    ["2026-06-25T06:00", "DEV-002", "Warehouse B", 24.0, 45, 1011, 79, "Online"],
    ["2026-06-25T05:00", "DEV-003", "Factory Floor", 33.0, 63, 1009, 60, "Warning"],
    ["2026-06-25T06:00", "DEV-003", "Factory Floor", 34.2, 65, 1008, 58, "Warning"],
    ["2026-06-25T05:00", "DEV-004", "Cold Storage", -19.0, 28, 1016, 45, "Online"],
    ["2026-06-25T06:00", "DEV-004", "Cold Storage", -18.8, 29, 1015, 43, "Online"],
    ["2026-06-25T05:00", "DEV-005", "Loading Dock", 24.5, 66, 1012, 16, "Online"],
    ["2026-06-25T06:00", "DEV-005", "Loading Dock", 25.2, 64, 1011, 14, "Online"],
    ["2026-06-25T07:00", "DEV-001", "Warehouse A", 22.5, 42, 1012, 91, "Online"],
    ["2026-06-25T08:00", "DEV-001", "Warehouse A", 23.0, 41, 1012, 90, "Online"],
    ["2026-06-25T07:00", "DEV-003", "Factory Floor", 35.0, 67, 1008, 55, "Warning"],
    ["2026-06-25T08:00", "DEV-003", "Factory Floor", 36.1, 70, 1007, 52, "Warning"],
    ["2026-06-25T07:00", "DEV-005", "Loading Dock", 25.8, 62, 1011, 11, "Online"],
    ["2026-06-25T08:00", "DEV-005", "Loading Dock", 26.3, 60, 1011, 8, "Online"],
  ], {
    columns: [
      { id: "timestamp", type: "DATE" },
      { id: "deviceId", type: "LABEL" },
      { id: "location", type: "LABEL" },
      { id: "temperature", type: "NUMBER" },
      { id: "humidity", type: "NUMBER" },
      { id: "pressure", type: "NUMBER" },
      { id: "battery", type: "NUMBER" },
      { id: "status", type: "LABEL" },
    ],
  }));

const devicesDataset = bind("devices", inlineSource([
    ["DEV-001", "Environmental Sensor A1", 51.5074, -0.1278, "Environmental", "2025-01-15", "Online"],
    ["DEV-002", "Environmental Sensor B1", 51.5080, -0.1290, "Environmental", "2025-02-20", "Online"],
    ["DEV-003", "Industrial Monitor F1", 51.5060, -0.1250, "Industrial", "2025-03-10", "Warning"],
    ["DEV-004", "Cold Chain Tracker C1", 51.5090, -0.1300, "Storage", "2025-04-05", "Online"],
    ["DEV-005", "Dock Sensor L1", 51.5055, -0.1240, "Environmental", "2025-05-12", "Online"],
    ["DEV-006", "Server Room Monitor S1", 51.5070, -0.1265, "Industrial", "2024-11-01", "Offline"],
  ], {
    columns: [
      { id: "deviceId", type: "LABEL" },
      { id: "name", type: "TEXT" },
      { id: "lat", type: "NUMBER" },
      { id: "lon", type: "NUMBER" },
      { id: "type", type: "LABEL" },
      { id: "installDate", type: "DATE" },
      { id: "status", type: "LABEL" },
    ],
  }));

export default page("Fleet Monitor",
  // Sidebar navigation
  sidebar({ navGroupId: "IoTNav" }),

  // === Page 1: Fleet Status ===
  page(
    "Fleet Status",
    // Row 1: Four metrics
    columns({}, ["3", "3", "3", "3"], [
      metric({
        lookup: lookup(
          "devices", filterBy("status", "NOT_IN", ["Offline"]),
          groupBy(null, count("deviceId"))),
        title: "Devices Online",
        columns: [{ id: "deviceId", pattern: "#" }],
      }),
    ], [
      metric({
        lookup: lookup("sensor_readings", groupBy(null, avg("temperature"))),
        title: "Avg Temperature",
      }),
    ], [
      metric({
        lookup: lookup("sensor_readings", groupBy(null, avg("humidity"))),
        title: "Avg Humidity",
      }),
    ], [
      metric({
        lookup: lookup(
          "sensor_readings", filterBy("battery", "LOWER_THAN", "20"),
          groupBy(null, count("battery"))),
        title: "Low Battery",
        columns: [{ id: "battery", pattern: "#" }],
      }),
    ]),

    // Row 2: Device registry table and three meters
    columns({}, ["8", "4"], [
      table({
        lookup: lookup("devices"),
        title: "Device Registry",
        sortable: true,
        filter: { listening: true },
      }),
    ], [
      meter({
        lookup: lookup("sensor_readings", groupBy(null, avg("temperature"))),
        title: "Temperature",
        end: 60,
        warning: 30,
        critical: 40,
        filter: { listening: true },
      }),
      meter({
        lookup: lookup("sensor_readings", groupBy(null, avg("humidity"))),
        title: "Humidity",
        end: 100,
        warning: 70,
        critical: 85,
        filter: { listening: true },
      }),
      meter({
        lookup: lookup("sensor_readings", groupBy(null, avg("pressure"))),
        title: "Pressure (hPa)",
        end: 1060,
        warning: 1020,
        critical: 1040,
        filter: { listening: true },
      }),
    ]),

    // Row 3: Location selector
    selector({
      subtype: "labels",
      lookup: lookup("sensor_readings", groupBy("location", col("location"))),
      filter: { notification: true },
    })
  ),

  // === Page 2: Sensor History ===
  page(
    "Sensor History",
    // Row 1: Temperature by device (area stacked with zoom)
    areaChart({
      subtype: "area-stacked",
      lookup: lookup(
        "sensor_readings", groupBy("deviceId", col("deviceId"), avg("temperature"))),
      title: "Temperature by Device",
      zoom: true,
      chart: { resizable: true, height: 300, grid: { x: false, y: false } },
    }),

    // Row 2: Humidity (smooth line) and Pressure (area)
    columns({}, ["6", "6"], [
      lineChart({
        subtype: "smooth",
        lookup: lookup(
          "sensor_readings", groupBy("deviceId", col("deviceId"), avg("humidity"))),
        title: "Humidity by Device",
        chart: { resizable: true, height: 300, grid: { x: false, y: false } },
      }),
    ], [
      areaChart({
        lookup: lookup(
          "sensor_readings", groupBy("deviceId", col("deviceId"), avg("pressure"))),
        title: "Pressure by Device",
        chart: { resizable: true, height: 300, grid: { x: false, y: false } },
      }),
    ]),

    // Row 3: Battery level timeseries
    timeseries({
      lookup: lookup(
        "sensor_readings", groupBy("timestamp", col("timestamp"), avg("battery"))),
      title: "Battery Level",
      chart: { resizable: true, height: 300, grid: { x: false, y: false } },
    })
  ),

  // === Page 3: Device Detail ===
  page(
    "Device Detail",
    // Row 1: Devices table
    table({
      lookup: lookup("devices"),
      title: "Devices",
      sortable: true,
      filter: { listening: true, notification: true },
    }),

    // Row 2: Readings by device and devices by type
    columns({}, ["6", "6"], [
      barChart({
        lookup: lookup(
          "sensor_readings", groupBy("deviceId", col("deviceId"), avg("temperature"), avg("humidity"))),
        title: "Readings by Device",
        filter: { listening: true },
        chart: { resizable: true, height: 300, grid: { x: false, y: false } },
      }),
    ], [
      pieChart({
        subtype: "donut",
        lookup: lookup(
          "devices", groupBy("type", col("type"), count("type"))),
        title: "Devices by Type",
        filter: { listening: true },
        chart: { resizable: true, height: 300, grid: { x: false, y: false } },
      }),
    ]),

    // Row 3: Sensor readings table
    table({
      lookup: lookup("sensor_readings"),
      title: "Sensor Readings",
      pageSize: 10,
      sortable: true,
      filter: { listening: true },
      columns: [{ id: "battery", pattern: "##%" }],
    })
  ),

  { mode: "dark", datasets: [sensorDataset, devicesDataset] });
