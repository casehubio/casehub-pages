export type QueueState = 'ready' | 'suspended' | 'blocked' | 'done';

export interface TriggerRef {
  type: 'data' | 'time';
  [key: string]: unknown;
}

export class StepQueue {
  state: QueueState = 'ready';
  position = 0;
  wakeTime?: number;
  blockReason?: Promise<void>;
  trigger?: TriggerRef;
  children: StepQueue[] = [];

  constructor(
    public readonly id: string,
    public readonly steps: unknown[],
    public readonly parent?: StepQueue,
  ) {
    if (parent) parent.children.push(this);
  }

  currentStep(): unknown | undefined {
    return this.position < this.steps.length ? this.steps[this.position] : undefined;
  }

  advance(): void {
    this.position++;
  }

  isDone(): boolean {
    return this.position >= this.steps.length;
  }

  block(reason?: Promise<void>, wakeTime?: number): void {
    this.state = 'blocked';
    this.blockReason = reason;
    this.wakeTime = wakeTime;
  }

  unblock(): void {
    this.state = 'ready';
    this.wakeTime = undefined;
    this.blockReason = undefined;
  }

  suspend(trigger: TriggerRef): void {
    this.state = 'suspended';
    this.trigger = trigger;
  }

  activate(): void {
    this.state = 'ready';
    this.trigger = undefined;
  }
}
