export interface ConsumerHandle {
  readonly name: string;
  stop(): void;
  isStopped(): boolean;
  readonly signal: AbortSignal;
}

export class DefaultConsumerHandle implements ConsumerHandle {
  private readonly controller = new AbortController();
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  stop(): void {
    this.controller.abort();
  }

  isStopped(): boolean {
    return this.controller.signal.aborted;
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }
}
