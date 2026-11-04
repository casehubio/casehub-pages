import { describe, it, expect, vi } from "vitest";
import { createRestAdapter } from "./rest-adapter.js";
import { dataSetId } from "@casehubio/pages-data";

describe("rest-adapter", () => {
  it("should send PATCH request with changed fields", async () => {
    const mockFetch = vi.fn(() => Promise.resolve({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ id: 1, name: "Updated", email: "updated@example.com" }),
    } as Response));

    const adapter = createRestAdapter(
      undefined,
      "https://api.example.com/users",
      mockFetch,
    );

    const result = await adapter.save(
      dataSetId("users"),
      { id: 1, name: "Updated", email: "updated@example.com" },
      ["name", "email"],
      "id",
      1,
    );

    expect(result.success).toBe(true);
    expect(result.updatedRecord).toEqual({ id: 1, name: "Updated", email: "updated@example.com" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/users/1",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ name: "Updated", email: "updated@example.com" }),
      }),
    );
  });

  it("should use custom method and headers from config", async () => {
    const mockFetch = vi.fn(() => Promise.resolve({
      ok: true,
      headers: new Headers(),
      json: () => Promise.resolve({}),
    } as Response));

    const adapter = createRestAdapter(
      {
        method: "PUT",
        headers: { "X-Custom-Header": "value" },
      },
      "https://api.example.com/users",
      mockFetch,
    );

    await adapter.save(
      dataSetId("users"),
      { id: 1, name: "Updated" },
      ["name"],
      "id",
      1,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/users/1",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Custom-Header": "value",
        }),
      }),
    );
  });

  it("should return error on HTTP failure", async () => {
    const mockFetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response));

    const adapter = createRestAdapter(
      undefined,
      "https://api.example.com/users",
      mockFetch,
    );

    const result = await adapter.save(
      dataSetId("users"),
      { id: 999, name: "Unknown" },
      ["name"],
      "id",
      999,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP 404");
  });

  it("should return error on network failure", async () => {
    const mockFetch = vi.fn(() => {
      throw new Error("Network error");
    });

    const adapter = createRestAdapter(
      undefined,
      "https://api.example.com/users",
      mockFetch,
    );

    const result = await adapter.save(
      dataSetId("users"),
      { id: 1, name: "Updated" },
      ["name"],
      "id",
      1,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
  });

  it("should handle non-JSON response", async () => {
    const mockFetch = vi.fn(() => Promise.resolve({
      ok: true,
      headers: new Headers({ "content-type": "text/plain" }),
    } as Response));

    const adapter = createRestAdapter(
      undefined,
      "https://api.example.com/users",
      mockFetch,
    );

    const result = await adapter.save(
      dataSetId("users"),
      { id: 1, name: "Updated" },
      ["name"],
      "id",
      1,
    );

    expect(result.success).toBe(true);
    expect(result.updatedRecord).toBeUndefined();
  });

  it("should parse 422 VALIDATION_FAILED into fieldErrors", async () => {
    const mockFetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: () => Promise.resolve({
        error: "VALIDATION_FAILED",
        violations: [
          { field: "name", constraint: "minLength", params: { min: 5 }, message: "must be at least 5 characters" },
          { field: "name", constraint: "pattern", params: { pattern: "^[A-Z]" }, message: "must match pattern" },
        ],
      }),
    } as Response));

    const adapter = createRestAdapter(
      undefined,
      "https://api.example.com/users",
      mockFetch,
    );

    const result = await adapter.save(
      dataSetId("users"),
      { id: 1, name: "ab" },
      ["name"],
      "id",
      1,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("VALIDATION_FAILED");
    expect(result.fieldErrors).toHaveLength(2);
    expect(result.fieldErrors![0].field).toBe("name");
    expect(result.fieldErrors![0].constraint).toBe("minLength");
    expect(result.fieldErrors![0].params).toEqual({ min: 5 });
    expect(result.fieldErrors![1].constraint).toBe("pattern");
  });

  it("should fall back to statusText for non-422 errors", async () => {
    const mockFetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response));

    const adapter = createRestAdapter(
      undefined,
      "https://api.example.com/users",
      mockFetch,
    );

    const result = await adapter.save(
      dataSetId("users"),
      { id: 1, name: "Updated" },
      ["name"],
      "id",
      1,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("HTTP 500: Internal Server Error");
    expect(result.fieldErrors).toBeUndefined();
  });
});
