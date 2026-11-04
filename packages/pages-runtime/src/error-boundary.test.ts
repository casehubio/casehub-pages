import { describe, it, expect, beforeEach } from "vitest";
import { renderErrorBoundary } from "./error-boundary.js";

describe("renderErrorBoundary", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("renders error message with page name", () => {
    renderErrorBoundary(container, "Dashboard", new Error("Parse failed"));

    expect(container.textContent).toContain("Dashboard");
    expect(container.textContent).toContain("Parse failed");
  });

  it("replaces existing content", () => {
    container.innerHTML = "<p>Old content</p>";
    renderErrorBoundary(container, "Test", new Error("Boom"));

    expect(container.textContent).not.toContain("Old content");
    expect(container.textContent).toContain("Boom");
  });

  it("has error styling", () => {
    renderErrorBoundary(container, "Test", new Error("Oops"));

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.getAttribute("data-error")).toBe("true");
  });
});
