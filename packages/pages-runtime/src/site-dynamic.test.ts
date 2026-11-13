import { describe, it, expect, vi } from "vitest";
import type { Component } from "@casehubio/pages-component";
import "@casehubio/pages-viz";
import { loadSite } from "./site.js";

function pageYaml(name: string): string {
  return `name: ${name}\ncomponents:\n  - type: title\n    properties:\n      text: ${name}\n`;
}

function createMockFetch(
  meta: Array<{ name: string; description?: string }>,
  pages: Record<string, string>,
): typeof globalThis.fetch {
  return vi.fn().mockImplementation((input: string | Request) => {
    const url = typeof input === "string" ? input : input.url;

    if (url.endsWith("/pages") || url.includes("/pages?")) {
      return Promise.resolve(new Response(JSON.stringify(meta), {
        headers: { "Content-Type": "application/json" },
      }));
    }

    const pageMatch = url.match(/\/pages\/([^/?]+)/);
    if (pageMatch) {
      const name = decodeURIComponent(pageMatch[1]!);
      const yaml = pages[name];
      if (yaml) {
        return Promise.resolve(new Response(JSON.stringify({ name, yaml }), {
          headers: { "Content-Type": "application/json" },
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }));
    }

    return Promise.resolve(new Response("{}", {
      headers: { "Content-Type": "application/json" },
    }));
  }) as typeof globalThis.fetch;
}

describe("loadSite — dynamic pages", () => {
  it("fetches page index when appId is provided", async () => {
    const mockFetch = createMockFetch(
      [{ name: "helpdesk", description: "Support page" }],
      { helpdesk: pageYaml("helpdesk") },
    );

    const target = document.createElement("div");
    document.body.appendChild(target);

    const site = await loadSite(
      target,
      { type: "page", props: { name: "App" } },
      { appId: "myapp", fetch: mockFetch, baseUrl: "http://localhost:8080" },
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/apps/myapp/pages"),
      expect.anything(),
    );

    site.dispose();
    document.body.removeChild(target);
  });

  it("adds dynamic pages to page index after fetch", async () => {
    const mockFetch = createMockFetch(
      [
        { name: "helpdesk", description: "Support" },
        { name: "reports", description: "Reports" },
      ],
      {
        helpdesk: pageYaml("helpdesk"),
        reports: pageYaml("reports"),
      },
    );

    const target = document.createElement("div");
    document.body.appendChild(target);

    const site = await loadSite(
      target,
      { type: "page", props: { name: "App" } },
      { appId: "myapp", fetch: mockFetch, baseUrl: "http://localhost:8080" },
    );

    expect(site.page("helpdesk")).not.toBeNull();
    expect(site.page("reports")).not.toBeNull();

    site.dispose();
    document.body.removeChild(target);
  });

  it("navigating to a dynamic page fetches and renders it", async () => {
    const mockFetch = createMockFetch(
      [{ name: "helpdesk" }],
      { helpdesk: pageYaml("helpdesk") },
    );

    const target = document.createElement("div");
    document.body.appendChild(target);

    const site = await loadSite(
      target,
      { type: "page", props: { name: "App" } },
      { appId: "myapp", fetch: mockFetch, baseUrl: "http://localhost:8080" },
    );

    site.navigate("helpdesk");
    await new Promise(r => setTimeout(r, 50));

    const titleEl = target.querySelector("[data-component-type='title']");
    expect(titleEl).not.toBeNull();

    site.dispose();
    document.body.removeChild(target);
  });

  it("renders error boundary when dynamic page fetch fails", async () => {
    const mockFetch = createMockFetch(
      [{ name: "broken" }],
      {},
    );

    const target = document.createElement("div");
    document.body.appendChild(target);

    const site = await loadSite(
      target,
      { type: "page", props: { name: "App" } },
      { appId: "myapp", fetch: mockFetch, baseUrl: "http://localhost:8080" },
    );

    site.navigate("broken");
    await new Promise(r => setTimeout(r, 50));

    const errorEl = target.querySelector("[data-error]");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain("broken");

    site.dispose();
    document.body.removeChild(target);
  });

  it("does not fetch page index when appId is absent", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}"));

    const target = document.createElement("div");
    document.body.appendChild(target);

    const site = await loadSite(
      target,
      { type: "page", props: { name: "App" } },
      { fetch: mockFetch as typeof globalThis.fetch },
    );

    const pageCalls = (mockFetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => String(c[0]).includes("/pages"),
    );
    expect(pageCalls).toHaveLength(0);

    site.dispose();
    document.body.removeChild(target);
  });

  it("cached dynamic page does not re-fetch on second navigation", async () => {
    const mockFetch = createMockFetch(
      [{ name: "helpdesk" }],
      { helpdesk: pageYaml("helpdesk") },
    );

    const target = document.createElement("div");
    document.body.appendChild(target);

    const site = await loadSite(
      target,
      { type: "page", props: { name: "App" } },
      { appId: "myapp", fetch: mockFetch, baseUrl: "http://localhost:8080" },
    );

    site.navigate("helpdesk");
    await new Promise(r => setTimeout(r, 50));
    site.navigate("helpdesk");
    await new Promise(r => setTimeout(r, 50));

    const pageFetches = (mockFetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => String(c[0]).includes("/pages/helpdesk"),
    );
    expect(pageFetches).toHaveLength(1);

    site.dispose();
    document.body.removeChild(target);
  });
});

describe("loadSite — URL params", () => {
  it("does not throw when root has properties param defs", async () => {
    const root: Component = {
      type: "page",
      props: {
        name: "App",
        properties: [
          { name: "ticketId", type: "string", required: false },
          { name: "view", type: "string", required: false, default: "summary" },
        ],
      },
    };

    const target = document.createElement("div");
    document.body.appendChild(target);

    const site = await loadSite(target, root);
    expect(site.root).toBeTruthy();

    site.dispose();
    document.body.removeChild(target);
  });

  it("works when root has no properties", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const site = await loadSite(target, { type: "page", props: { name: "App" } });
    expect(site.root).toBeTruthy();

    site.dispose();
    document.body.removeChild(target);
  });
});
