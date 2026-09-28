import { test, expect } from "@playwright/test";

const EXAMPLES = [
  { idx: 0, name: "Counter", expectedOutputs: ["counter(requests) += 1 → 1", "counter(requests) += 3 → 5", "counter(requests) = 3"] },
  { idx: 1, name: "Flag", expectedOutputs: ["flag(ready) = false", "flag(ready).set() → true", "flag(ready) = true", "flag(ready).toggle() → false"] },
  { idx: 2, name: "Gauge", expectedOutputs: ["gauge(temp) := 20", "gauge(temp) = 35", "gauge(temp).cas(35, 42) → swapped"] },
  { idx: 3, name: "Accumulator", expectedOutputs: ["sum(total) << 10", "sum(total) << 25", "accumulator(total) = 42", "accumulator(max-seen) = 99"] },
  { idx: 4, name: "Latch", expectedOutputs: ["latch(init-gate) created with count=3", "remaining=2", "count=0", "(tripped)"] },
  { idx: 5, name: "State Machine", expectedOutputs: ["sm(order) created", "state = draft", "draft → submitted (ok)", "state = approved"] },
];

async function openCoordinationPrimitives(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator("#sample-count").waitFor({ timeout: 10000 });
  await page.locator('.sample-item:has-text("Coordination Primitives")').first().click();
  await page.locator("#sample-container").waitFor({ state: "visible" });
  await page.locator("#cp-run-btn").waitFor({ state: "visible", timeout: 10000 });
}

test.describe("Coordination Primitives — all 6 sub-examples", () => {
  for (const ex of EXAMPLES) {
    test(`${ex.name} runs and produces expected output`, async ({ page }) => {
      await openCoordinationPrimitives(page);

      const picker = page.locator("#cp-example-picker");
      await picker.selectOption(String(ex.idx));

      await page.click("#cp-run-btn");

      await expect(page.locator("#cp-state")).toHaveText(/done|error/, { timeout: 15000 });

      const state = await page.locator("#cp-state").textContent();
      expect(state).toBe("done");

      const result = await page.locator("#cp-result").textContent();
      expect(result).toBe("success");

      const outputEl = page.locator("#cp-output");
      const outputText = await outputEl.textContent();

      for (const expected of ex.expectedOutputs) {
        expect(outputText).toContain(expected);
      }

      const count = await page.locator("#cp-count").textContent();
      expect(Number(count)).toBeGreaterThan(0);
    });
  }
});
