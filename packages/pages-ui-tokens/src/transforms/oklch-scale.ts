import type { TokenMap, TokenLeaf } from '../types.js';
import { generateScale } from '../colours.js';

export function oklchScale(tokens: TokenMap, params: Record<string, unknown>): TokenMap {
  const hues = params['hues'] as Record<string, number> | undefined;
  if (!hues) return tokens;
  const chroma = (params['chroma'] as number) ?? 0.12;
  const contrast = (params['contrast'] as number) ?? 0.5;
  const customSteps = params['steps'] as number[] | undefined;
  const mode = (tokens['$mode'] as TokenLeaf | undefined)?.$value ?? 'light';
  const isDark = mode === 'dark';

  const result: Record<string, unknown> = { ...tokens };

  for (const [name, hue] of Object.entries(hues)) {
    const chromaVal = name === 'neutral' ? chroma * 0.15 : chroma;
    const scale = generateScale(hue, chromaVal, contrast, isDark, customSteps);
    const group: Record<string, TokenLeaf> = {};
    for (const [step, value] of Object.entries(scale)) {
      group[step] = { $value: value, $type: 'color' };
    }
    result[name] = { ...(result[name] as Record<string, unknown> ?? {}), ...group };
  }

  return result as TokenMap;
}
