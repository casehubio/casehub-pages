export type PanelMode = 'closed' | 'docked' | 'floating';

export interface PanelControllerOptions {
  initialMode?: PanelMode;
  onChange?: (mode: PanelMode) => void;
}

export class PanelController {
  private _mode: PanelMode;
  private _onChange: ((mode: PanelMode) => void) | undefined;

  constructor(options: PanelControllerOptions = {}) {
    this._mode = options.initialMode ?? 'closed';
    this._onChange = options.onChange;
  }

  get mode(): PanelMode {
    return this._mode;
  }

  setMode(mode: PanelMode): void {
    if (mode === this._mode) return;
    this._mode = mode;
    this._onChange?.(this._mode);
  }

  toggle(): void {
    this.setMode(this._mode === 'closed' ? 'docked' : 'closed');
  }
}
