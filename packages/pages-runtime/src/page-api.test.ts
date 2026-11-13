import { describe, it, expect, vi } from "vitest";
import { PageApiClient } from "./page-api.js";
import type { PageMetadata } from "./page-api.js";

describe("PageApiClient", () => {
  it("lists pages with metadata only", async () => {
    const mockResponse: PageMetadata[] = [
      { name: "Dashboard", description: "Main view", source: "static" },
      { name: "custom", description: "User page" },
    ];

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const client = new PageApiClient("helpdesk", fetchFn as unknown as typeof fetch);
    const pages = await client.list();
    expect(pages).toHaveLength(2);
    expect(pages[0]!.name).toBe("Dashboard");
    expect(fetchFn).toHaveBeenCalledWith("/api/apps/helpdesk/pages", expect.any(Object));
  });

  it("gets full page including yaml", async () => {
    const mockPage = { name: "Dashboard", yaml: "name: Dashboard\ncomponents: []" };

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPage),
    });

    const client = new PageApiClient("helpdesk", fetchFn as unknown as typeof fetch);
    const page = await client.get("Dashboard");
    expect(page.yaml).toContain("Dashboard");
  });

  it("throws on 404", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    });

    const client = new PageApiClient("helpdesk", fetchFn as unknown as typeof fetch);
    await expect(client.get("nonexistent")).rejects.toThrow("Not found");
  });
});
