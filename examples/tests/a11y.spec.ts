import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "fs";
import { join } from "path";

interface Sample {
  name: string;
  path: string;
  category: string;
  file: string;
}

interface SamplesData {
  totalSamples: number;
  categories: Array<{
    category: string;
    samples: Sample[];
  }>;
}

const samplesPath = join(__dirname, "../dist/samples.json");
const samples: SamplesData = JSON.parse(readFileSync(samplesPath, "utf-8"));

const A11Y_SAMPLES = [
  "Charts",
  "Forms",
  "Metrics",
  "Contact Manager",
].filter((name) =>
  samples.categories.some((c) => c.samples.some((s) => s.name === name)),
);

async function openSample(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor();
  await page.locator(`.sample-item:has-text("${name}")`).first().click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const target = document.getElementById("sample-target");
    if (!target) return false;
    const skip = new Set(["page", "panel", "tabs", "sidebar", "accordion", "carousel", "stack", "pills", "html", "title", "markdown", "selector"]);
    for (const c of target.querySelectorAll("[data-component-type]")) {
      const type = (c as HTMLElement).dataset.componentType!;
      if (skip.has(type)) continue;
      const vizEl = c.querySelector(`pages-${type}`) as HTMLElement & { dataSet?: unknown };
      if (vizEl?.dataSet) return true;
    }
    return false;
  }, { timeout: 10000 });
}

test.describe("Accessibility — axe-core ARIA validation", () => {
  for (const sampleName of A11Y_SAMPLES) {
    test(`${sampleName} — no critical/serious axe violations`, async ({ page }) => {
      await openSample(page, sampleName);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules(["color-contrast", "page-has-heading-one"])
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      if (critical.length > 0) {
        const summary = critical.map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`,
        );
        expect(critical, `axe violations in "${sampleName}":\n${summary.join("\n")}`).toHaveLength(0);
      }
    });
  }
});
