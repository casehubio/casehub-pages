export function renderErrorBoundary(
  container: HTMLElement,
  pageName: string,
  error: Error,
): void {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-error", "true");
  wrapper.style.padding = "var(--spacing-lg, 24px)";
  wrapper.style.margin = "var(--spacing-md, 16px)";
  wrapper.style.borderLeft = "4px solid var(--color-error, #d32f2f)";
  wrapper.style.borderColor = "var(--color-error, #d32f2f)";
  wrapper.style.background = "var(--color-surface-error, #fef2f2)";
  wrapper.style.borderRadius = "var(--radius-md, 4px)";
  wrapper.style.fontFamily = "var(--font-family-mono, monospace)";

  const heading = document.createElement("h3");
  heading.style.margin = "0 0 8px 0";
  heading.style.color = "var(--color-error, #d32f2f)";
  heading.textContent = `Failed to load page: ${pageName}`;

  const message = document.createElement("p");
  message.style.margin = "0";
  message.style.whiteSpace = "pre-wrap";
  message.textContent = error.message;

  wrapper.appendChild(heading);
  wrapper.appendChild(message);
  container.appendChild(wrapper);
}
