export interface OrcCounter {
  increment(): void;
  decrement(): void;
  add(delta: number): void;
  get(): number;
  reset(): void;
}

export class DefaultOrcCounter implements OrcCounter {
  private value = 0;

  increment(): void { this.value++; }
  decrement(): void { this.value--; }
  add(delta: number): void { this.value += delta; }
  get(): number { return this.value; }
  reset(): void { this.value = 0; }
}
