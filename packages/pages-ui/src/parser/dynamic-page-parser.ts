import type { Component } from "../model/types.js";
import { substituteProperties } from "./property-substitution.js";
import { parsePageContent } from "./page-parser.js";

export function parseDynamicPage(
  raw: Record<string, unknown>,
  globalDisplayerDefaults?: Record<string, unknown>,
): Component {
  const pageName = (raw["name"] as string | undefined) ?? "Untitled";

  const properties = (raw["properties"] ?? {}) as Record<string, string>;
  const substituted = substituteProperties(raw, properties) as Record<string, unknown>;

  const pageProps = substituted["properties"] as Record<string, string> | undefined;
  const pageStyle =
    pageProps && typeof pageProps === "object" && Object.keys(pageProps).length > 0
      ? pageProps
      : undefined;

  const dataScope = substituted["dataScope"] as Record<string, unknown> | undefined;

  let save: Record<string, unknown> | undefined;
  if (substituted["save"]) {
    const rawSave = substituted["save"] as Record<string, unknown>;
    const adapter = rawSave["adapter"] as string | undefined;
    const adapterConfig = adapter && adapter in rawSave
      ? rawSave[adapter] as Record<string, unknown>
      : undefined;
    save = {
      ...(rawSave["trigger"] !== undefined && { trigger: rawSave["trigger"] }),
      ...(rawSave["delay"] !== undefined && { delay: rawSave["delay"] }),
      ...(adapter && { adapter }),
      ...(adapterConfig && { adapterConfig }),
    };
  }

  const layout = parsePageContent(substituted, 0, globalDisplayerDefaults);

  return {
    type: "page" as const,
    props: {
      name: pageName,
      ...(dataScope && { dataScope }),
      ...(save && { save }),
    },
    ...(pageStyle ? { style: pageStyle } : {}),
    ...layout,
  };
}
