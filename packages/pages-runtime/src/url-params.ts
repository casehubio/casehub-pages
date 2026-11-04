export interface ParamDef {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly default?: string;
}

export function extractUrlParams(
  search: string,
  paramDefs?: readonly ParamDef[],
): Record<string, string> {
  const urlParams = new URLSearchParams(search);
  const result: Record<string, string> = {};

  if (!paramDefs) {
    urlParams.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  for (const def of paramDefs) {
    const value = urlParams.get(def.name);
    if (value !== null) {
      result[def.name] = value;
    } else if (def.default !== undefined) {
      result[def.name] = def.default;
    }
  }

  return result;
}
