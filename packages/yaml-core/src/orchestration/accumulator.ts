export interface OrcAccumulator {
  accumulate(value: number): void;
  get(): number;
  reset(): void;
}

export class DefaultOrcAccumulator implements OrcAccumulator {
  private value: number;

  constructor(
    private readonly op: (a: number, b: number) => number,
    private readonly identity: number,
  ) {
    this.value = identity;
  }

  accumulate(value: number): void { this.value = this.op(this.value, value); }
  get(): number { return this.value; }
  reset(): void { this.value = this.identity; }
}
