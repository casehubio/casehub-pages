import { SCOPED, OBSERVERS, PUBLISHERS } from "./symbols.js";
import type { ObserverEntry, PublisherEntry } from "./decorators.js";

export function isApplicationScoped(constructor: Function): boolean {
  return (constructor as any)[SCOPED] === true;
}

export function getObservers(prototype: Object): readonly ObserverEntry[] {
  return (prototype as any)[OBSERVERS] ?? [];
}

export function getPublishers(prototype: Object): readonly PublisherEntry[] {
  return (prototype as any)[PUBLISHERS] ?? [];
}
