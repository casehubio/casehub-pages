import { SCOPED, OBSERVERS, PUBLISHERS } from "./symbols.js";
import type { ObserverEntry, PublisherEntry } from "./decorators.js";

type Metadata = Partial<Record<symbol, unknown>>;

export function isApplicationScoped(constructor: object): boolean {
  return (constructor as Metadata)[SCOPED] === true;
}

export function getObservers(prototype: object): readonly ObserverEntry[] {
  return ((prototype as Metadata)[OBSERVERS] as ObserverEntry[] | undefined) ?? [];
}

export function getPublishers(prototype: object): readonly PublisherEntry[] {
  return ((prototype as Metadata)[PUBLISHERS] as PublisherEntry[] | undefined) ?? [];
}
