import { EventStream, matchesTopic, isValidTopicOrPattern } from "@casehubio/pages-data";
import { isApplicationScoped, getObservers, getPublishers } from "./metadata.js";
import type { ObserverEntry, PublisherEntry } from "./decorators.js";

export interface EventContainerConfig {
  wsUrl: string;
  publishBaseUrl: string;
  auth?: { token: string };
}

interface Registration {
  constructor: new (...args: any[]) => any;
  observers: readonly ObserverEntry[];
  publishers: readonly PublisherEntry[];
}

export class EventContainer {
  private readonly config: EventContainerConfig;
  private readonly registrations: Registration[] = [];
  private readonly instances = new Map<Function, any>();
  private readonly streams: EventStream[] = [];
  private started = false;

  constructor(config: EventContainerConfig) {
    this.config = config;
  }

  register(...classes: Function[]): void {
    if (this.started) {
      throw new Error("Cannot register after container has started");
    }
    for (const clazz of classes) {
      if (!isApplicationScoped(clazz)) {
        throw new Error(
          `${clazz.name} is not decorated with @ApplicationScoped`,
        );
      }
      const proto = clazz.prototype;
      const observers = getObservers(proto);
      const publishers = getPublishers(proto);

      for (const o of observers) {
        if (!isValidTopicOrPattern(o.topic)) {
          throw new Error(
            `Invalid topic pattern '${o.topic}' on ${clazz.name}.${o.methodName}`,
          );
        }
      }
      for (const p of publishers) {
        if (!isValidTopicOrPattern(p.topic)) {
          throw new Error(
            `Invalid topic pattern '${p.topic}' on ${clazz.name}.${p.methodName}`,
          );
        }
      }

      this.registrations.push({
        constructor: clazz as new (...args: any[]) => any,
        observers,
        publishers,
      });
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    for (const reg of this.registrations) {
      const instance = new reg.constructor();
      this.instances.set(reg.constructor, instance);
      this.wirePublishers(instance, reg.publishers);
    }

    const allTopics = this.registrations.flatMap((r) =>
      r.observers.map((o) => o.topic),
    );
    const uniqueTopics = [...new Set(allTopics)];

    if (uniqueTopics.length > 0) {
      const stream = new EventStream(this.config.wsUrl, uniqueTopics, {
        onChange: () => this.dispatchLatest(stream),
      });
      this.streams.push(stream);
      stream.connect();
    }
  }

  stop(): void {
    for (const stream of this.streams) {
      stream.disconnect();
    }
    this.streams.length = 0;
    this.instances.clear();
    this.started = false;
  }

  getInstance<T>(clazz: new (...args: any[]) => T): T {
    const instance = this.instances.get(clazz);
    if (!instance) {
      throw new Error(
        `No instance for ${clazz.name} — not registered or container not started`,
      );
    }
    return instance as T;
  }

  private dispatchLatest(stream: EventStream): void {
    const event = stream.latest;
    if (!event) return;

    const detail = event as { topic?: string; payload?: unknown };
    const topic = detail.topic;
    const payload = detail.payload ?? event;

    for (const reg of this.registrations) {
      const instance = this.instances.get(reg.constructor);
      if (!instance) continue;

      for (const obs of reg.observers) {
        if (topic && matchesTopic(obs.topic, topic)) {
          instance[obs.methodName](payload);
        } else if (!topic) {
          instance[obs.methodName](event);
        }
      }
    }
  }

  private wirePublishers(
    instance: any,
    publishers: readonly PublisherEntry[],
  ): void {
    const { publishBaseUrl, auth } = this.config;

    for (const pub of publishers) {
      const original = instance[pub.methodName].bind(instance);
      instance[pub.methodName] = async (
        ...args: any[]
      ): Promise<{ seq: number } | undefined> => {
        const payload = original(...args);
        if (payload == null) return undefined;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (auth?.token) {
          headers["Authorization"] = `Bearer ${auth.token}`;
        }

        const response = await fetch(
          `${publishBaseUrl}/api/push/publish/${pub.topic}`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          },
        );
        return response.json() as Promise<{ seq: number }>;
      };
    }
  }
}
