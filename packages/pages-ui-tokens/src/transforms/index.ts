import { registerTransform } from '../registry.js';
import { registerBuiltinPreset } from '../preset-loader.js';
import type { PresetConfig } from '../types.js';
import { oklchScale } from './oklch-scale.js';
import { lightMode } from './light-mode.js';
import { darkMode } from './dark-mode.js';
import { lightnessShift } from './lightness-shift.js';
import { lightnessSteps } from './lightness-steps.js';
import { chromaCurve } from './chroma-curve.js';
import { semanticHues } from './semantic-hues.js';
import { override } from './override.js';
import { semanticMap } from './semantic-map.js';
import { contrastCheck } from './contrast-check.js';
import { gamutClamp } from './gamut-clamp.js';

const DEFAULT_HUES = {
  hues: { accent: 245, neutral: 220, success: 145, warning: 55, danger: 25, info: 210 },
  chroma: 0.12,
  contrast: 0.5,
};

const DEFAULT_LIGHT_PRESET: PresetConfig = {
  $name: 'default-light',
  $description: 'Pages generic light theme',
  pipeline: [
    { transform: 'light-mode' },
    { transform: 'oklch-scale', params: DEFAULT_HUES },
    { transform: 'semantic-map' },
    { transform: 'gamut-clamp' },
  ],
};

const DEFAULT_DARK_PRESET: PresetConfig = {
  $name: 'default-dark',
  $description: 'Pages generic dark theme',
  pipeline: [
    { transform: 'dark-mode' },
    { transform: 'oklch-scale', params: DEFAULT_HUES },
    { transform: 'semantic-map' },
    { transform: 'gamut-clamp' },
  ],
};

export function registerCoreTransforms(): void {
  registerTransform('oklch-scale', oklchScale);
  registerTransform('light-mode', lightMode);
  registerTransform('dark-mode', darkMode);
  registerTransform('lightness-shift', lightnessShift);
  registerTransform('lightness-steps', lightnessSteps);
  registerTransform('chroma-curve', chromaCurve);
  registerTransform('semantic-hues', semanticHues);
  registerTransform('override', override);
  registerTransform('semantic-map', semanticMap);
  registerTransform('contrast-check', contrastCheck);
  registerTransform('gamut-clamp', gamutClamp);
}

const CASEHUB_BRAND_HUES = { hues: { violet: 270, green: 160, magenta: 320 } };

const CASEHUB_STEPS = [16, 21, 25, 29, 35, 42, 49, 55, 68, 76, 86, 93];

const CASEHUB_DARK_PRESET: PresetConfig = {
  $name: 'casehub-dark',
  $description: 'CaseHub brand dark theme — Claudony / casehub.org look',
  $extends: 'default-dark',
  pipeline: [
    { transform: 'oklch-scale', params: { hues: { accent: 215, neutral: [260, 215] }, chroma: 0.30, steps: CASEHUB_STEPS } },
    { transform: 'oklch-scale', params: { ...CASEHUB_BRAND_HUES, steps: CASEHUB_STEPS, chroma: 0.12 } },
    { transform: 'chroma-curve', params: { curve: 'gaussian', neutral: 1.8, accent: 0.52 } },
    { transform: 'semantic-hues', params: { success: 175, warning: 85 } },
    { transform: 'semantic-map' },
    { transform: 'gamut-clamp' },
  ],
};

const CASEHUB_LIGHT_PRESET: PresetConfig = {
  $name: 'casehub-light',
  $description: 'CaseHub brand light theme',
  $extends: 'default-light',
  pipeline: [
    { transform: 'oklch-scale', params: CASEHUB_BRAND_HUES },
    { transform: 'chroma-curve', params: { curve: 'gaussian', neutral: 0.02 } },
    { transform: 'semantic-hues', params: { success: 175, warning: 100 } },
    { transform: 'semantic-map' },
    { transform: 'gamut-clamp' },
  ],
};

const NORD_HUES = { hues: { accent: 210, neutral: 220, success: 145, warning: 40, danger: 355, info: 195 }, chroma: 0.08, contrast: 0.45 };
const SOLARIZED_HUES = { hues: { accent: 175, neutral: 55, success: 105, warning: 45, danger: 18, info: 200 }, chroma: 0.10, contrast: 0.55 };
const DRACULA_HUES = { hues: { accent: 270, neutral: 240, success: 115, warning: 60, danger: 0, info: 195 }, chroma: 0.18, contrast: 0.55 };
const GITHUB_HUES = { hues: { accent: 215, neutral: 215, success: 140, warning: 40, danger: 5, info: 210 }, chroma: 0.04, contrast: 0.60 };
const MONOKAI_HUES = { hues: { accent: 80, neutral: 50, success: 95, warning: 35, danger: 345, info: 190 }, chroma: 0.15, contrast: 0.50 };

function makePresetPair(name: string, description: string, hues: Record<string, unknown>): [PresetConfig, PresetConfig] {
  return [
    { $name: `${name}-light`, $description: `${description} — light`, pipeline: [
      { transform: 'light-mode' }, { transform: 'oklch-scale', params: hues }, { transform: 'semantic-map' }, { transform: 'gamut-clamp' },
    ]},
    { $name: `${name}-dark`, $description: `${description} — dark`, pipeline: [
      { transform: 'dark-mode' }, { transform: 'oklch-scale', params: hues }, { transform: 'semantic-map' }, { transform: 'gamut-clamp' },
    ]},
  ];
}

const [NORD_LIGHT, NORD_DARK] = makePresetPair('nord', 'Arctic blue — muted frost palette', NORD_HUES);
const [SOLARIZED_LIGHT, SOLARIZED_DARK] = makePresetPair('solarized', 'Precision colours for machines and people', SOLARIZED_HUES);
const [DRACULA_LIGHT, DRACULA_DARK] = makePresetPair('dracula', 'Vivid purple with high contrast accents', DRACULA_HUES);
const [GITHUB_LIGHT, GITHUB_DARK] = makePresetPair('github', 'Clean and neutral — familiar professional look', GITHUB_HUES);
const [MONOKAI_LIGHT, MONOKAI_DARK] = makePresetPair('monokai', 'Warm tones with vibrant yellow-green accent', MONOKAI_HUES);

export function initPresets(): void {
  registerCoreTransforms();
  registerBuiltinPreset(DEFAULT_LIGHT_PRESET);
  registerBuiltinPreset(DEFAULT_DARK_PRESET);
  registerBuiltinPreset(CASEHUB_DARK_PRESET);
  registerBuiltinPreset(CASEHUB_LIGHT_PRESET);
  registerBuiltinPreset(NORD_LIGHT!);
  registerBuiltinPreset(NORD_DARK!);
  registerBuiltinPreset(SOLARIZED_LIGHT!);
  registerBuiltinPreset(SOLARIZED_DARK!);
  registerBuiltinPreset(DRACULA_LIGHT!);
  registerBuiltinPreset(DRACULA_DARK!);
  registerBuiltinPreset(GITHUB_LIGHT!);
  registerBuiltinPreset(GITHUB_DARK!);
  registerBuiltinPreset(MONOKAI_LIGHT!);
  registerBuiltinPreset(MONOKAI_DARK!);
}

export { oklchScale } from './oklch-scale.js';
export { lightMode } from './light-mode.js';
export { darkMode } from './dark-mode.js';
export { lightnessShift } from './lightness-shift.js';
export { lightnessSteps } from './lightness-steps.js';
export { chromaCurve } from './chroma-curve.js';
export { semanticHues } from './semantic-hues.js';
export { override } from './override.js';
export { semanticMap } from './semantic-map.js';
export { contrastCheck } from './contrast-check.js';
export { gamutClamp } from './gamut-clamp.js';
