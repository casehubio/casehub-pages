export type ViewerMode = 'yaml' | 'visual' | 'split';

export interface ViewerControllerOptions {
  initialMode?: ViewerMode;
  initialSplitRatio?: number;
  onChange?: (mode: ViewerMode, splitRatio: number) => void;
}

const CYCLE_ORDER: ViewerMode[] = ['yaml', 'split', 'visual'];

export class ViewerController {
  private _mode: ViewerMode;
  private _splitRatio: number;
  private _onChange: ((mode: ViewerMode, splitRatio: number) => void) | undefined;

  constructor(options: ViewerControllerOptions = {}) {
    this._mode = options.initialMode ?? 'split';
    this._splitRatio = options.initialSplitRatio ?? 0.5;
    this._onChange = options.onChange;
  }

  get mode(): ViewerMode {
    return this._mode;
  }

  get splitRatio(): number {
    return this._splitRatio;
  }

  setMode(mode: ViewerMode): void {
    if (mode === this._mode) return;
    this._mode = mode;
    this._onChange?.(this._mode, this._splitRatio);
  }

  cycle(): void {
    const idx = CYCLE_ORDER.indexOf(this._mode);
    this._mode = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length]!;
    this._onChange?.(this._mode, this._splitRatio);
  }

  setSplitRatio(ratio: number): void {
    const clamped = Math.max(0.15, Math.min(0.85, ratio));
    if (clamped === this._splitRatio) return;
    this._splitRatio = clamped;
    this._onChange?.(this._mode, this._splitRatio);
  }
}
