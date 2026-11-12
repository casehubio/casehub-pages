import { parseDocument, stringify } from "yaml";

export function needsMigration(yaml: string): boolean {
  const parsed = parseDocument(yaml).toJSON() as Record<string, unknown> | null;
  if (!parsed) return false;
  const pages = parsed["pages"] as Record<string, unknown>[] | undefined;
  if (!pages) return false;
  return pages.some(p => "rows" in p || ("components" in p && !("items" in p)));
}

interface MigItem {
  placement: { x: number; y: number; w: number; h: number };
  component?: Record<string, unknown>;
}

export function migrateRowsToItems(yaml: string): string {
  if (!needsMigration(yaml)) return yaml;

  const doc = parseDocument(yaml);
  const json = doc.toJSON() as Record<string, unknown>;
  const pages = json["pages"] as Record<string, unknown>[] | undefined;
  if (!pages) return yaml;

  let changed = false;
  for (const page of pages) {
    const rows = page["rows"] as Record<string, unknown>[] | undefined;
    const components = page["components"] as Record<string, unknown>[] | undefined;

    if (rows) {
      const items: MigItem[] = [];
      let y = 0;
      for (const row of rows) {
        const cols = (row["columns"] ?? row["layoutColumns"]) as Record<string, unknown>[] | undefined;
        if (!cols) { y++; continue; }
        let x = 0;
        let maxCompsInRow = 1;
        for (const col of cols) {
          const span = Number(col["span"] ?? 12);
          const colComps = (col["components"] ?? col["layoutComponents"]) as Record<string, unknown>[] | undefined;
          if (colComps) {
            if (colComps.length > maxCompsInRow) maxCompsInRow = colComps.length;
            for (let ci = 0; ci < colComps.length; ci++) {
              items.push({
                placement: { x, y: y + ci, w: span, h: 1 },
                component: colComps[ci]!,
              });
            }
          }
          x += span;
        }
        y += maxCompsInRow;
      }
      delete page["rows"];
      page["items"] = items;
      changed = true;
    } else if (components && !("items" in page)) {
      const items: MigItem[] = components.map((comp, i) => ({
        placement: { x: 0, y: i, w: 12, h: 1 },
        component: comp,
      }));
      delete page["components"];
      page["items"] = items;
      changed = true;
    }
  }

  return changed ? stringify(json, { lineWidth: 0 }) : yaml;
}
