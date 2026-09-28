import { test, expect } from "@playwright/test";

const EXAMPLES = [
  { idx: 0, name: "Block (sequential)", expectedOutputs: ["Step 1: initialize", "Step 2: process", "Step 3: finalize"] },
  { idx: 1, name: "Parallel", expectedOutputs: ["Branch A: fetching data", "Branch B: loading config", "Branch C: warming cache"] },
  { idx: 2, name: "If / Else", expectedOutputs: ["Condition was true", "False branch taken"] },
  { idx: 3, name: "Match / Cases", expectedOutputs: ["Matched: warning"] },
  { idx: 4, name: "Try / Catch / Finally", expectedOutputs: ["Attempting risky operation", "Caught error — recovering", "Cleanup — always runs"] },
  { idx: 5, name: "Barrier", expectedOutputs: ["Fetching data", "Loading config", "Both done — proceeding"] },
  { idx: 6, name: "Quorum", expectedOutputs: ["Primary completed", "Secondary completed", "Tertiary completed", "Quorum met — 2 of 3 done"] },
  { idx: 7, name: "Select (first-to-complete)", expectedOutputs: ["Fast branch won the race"] },
];

async function openStepWorkflows(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor({ timeout: 10000 });
  await page.locator('.sample-item:has-text("Step Workflows")').first().click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.locator("#sw-run-btn").waitFor({ state: "visible", timeout: 10000 });
}

test.describe("Step Workflows — all 8 sub-examples", () => {
  for (const ex of EXAMPLES) {
    test(`${ex.name} runs and produces expected output`, async ({ page }) => {
      await openStepWorkflows(page);

      const picker = page.locator("#sw-example-picker");
      await picker.selectOption(String(ex.idx));

      await page.click("#sw-run-btn");

      await expect(page.locator("#sw-state")).toHaveText(/done|error/, { timeout: 15000 });

      const state = await page.locator("#sw-state").textContent();
      expect(state).toBe("done");

      const result = await page.locator("#sw-result").textContent();
      expect(result).toBe("success");

      const outputEl = page.locator("#sw-output");
      const outputText = await outputEl.textContent();

      for (const expected of ex.expectedOutputs) {
        expect(outputText).toContain(expected);
      }

      const count = await page.locator("#sw-count").textContent();
      expect(Number(count)).toBeGreaterThan(0);
    });
  }
});
