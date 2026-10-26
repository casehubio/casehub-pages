export interface ActivationTriggerBase {
  readonly type: string;
  readonly onRetrigger: 'skip' | 'queue';
  readonly maxQueued: number;
}

export interface CloudEventActivationTrigger extends ActivationTriggerBase {
  readonly type: 'cloud-event';
  readonly eventType: string;
  readonly filter: Record<string, string>;
  readonly source?: string;
}

export interface ScheduledActivationTrigger extends ActivationTriggerBase {
  readonly type: 'scheduled';
  readonly cron: string;
}

export type ActivationTrigger =
  | CloudEventActivationTrigger
  | ScheduledActivationTrigger;

export function parseActivationTriggers(
  raw: unknown[] | undefined,
): ActivationTrigger[] {
  if (!raw || !Array.isArray(raw)) return [];

  return raw.map((entry: any) => {
    const onRetrigger: 'skip' | 'queue' =
      entry['on-retrigger'] === 'queue' ? 'queue' : 'skip';
    const maxQueued: number = entry['max-queued'] ?? 10;

    switch (entry.type) {
      case 'cloud-event':
        return {
          type: 'cloud-event' as const,
          eventType: entry['event-type'],
          filter: entry.filter ?? {},
          source: entry.source,
          onRetrigger,
          maxQueued,
        };
      case 'scheduled':
        return {
          type: 'scheduled' as const,
          cron: entry.cron,
          onRetrigger,
          maxQueued,
        };
      default:
        throw new Error(`Unknown activation trigger type: ${entry.type}`);
    }
  });
}
