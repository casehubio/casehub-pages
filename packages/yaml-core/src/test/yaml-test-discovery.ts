import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Preserve the published static facade.
export class YamlTestDiscovery {
  static scan(dir: string): string[] {
    const results: string[] = [];
    YamlTestDiscovery.walk(dir, results);
    return results.sort();
  }

  private static walk(dir: string, results: string[]): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        YamlTestDiscovery.walk(full, results);
      } else if (entry.endsWith('.test.yaml') || entry.endsWith('.test.yml')) {
        results.push(full);
      }
    }
  }
}
