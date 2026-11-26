import { SCOPED, OBSERVERS, PUBLISHERS } from "./symbols.js";

export interface ObserverEntry {
  topic: string;
  methodName: string;
}

export interface PublisherEntry {
  topic: string;
  methodName: string;
}

export function ApplicationScoped<T extends new (...args: any[]) => any>(
  constructor: T,
): T {
  (constructor as any)[SCOPED] = true;
  return constructor;
}

export function Observes(topic: string): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor,
  ) {
    const inherited: ObserverEntry[] = (target as any)[OBSERVERS] ?? [];
    const entries = Object.hasOwn(target, OBSERVERS) ? inherited : [...inherited];
    entries.push({ topic, methodName: String(propertyKey) });
    (target as any)[OBSERVERS] = entries;
  };
}

export function Publish(topic: string): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor,
  ) {
    const inherited: PublisherEntry[] = (target as any)[PUBLISHERS] ?? [];
    const entries = Object.hasOwn(target, PUBLISHERS) ? inherited : [...inherited];
    entries.push({ topic, methodName: String(propertyKey) });
    (target as any)[PUBLISHERS] = entries;
  };
}
