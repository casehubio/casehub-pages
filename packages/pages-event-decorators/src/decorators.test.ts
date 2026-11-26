import { describe, it, expect } from "vitest";
import { ApplicationScoped, Observes, Publish } from "./decorators.js";
import { isApplicationScoped, getObservers, getPublishers } from "./metadata.js";

describe("@ApplicationScoped", () => {
  it("marks a class as container-managed", () => {
    @ApplicationScoped
    class MyBean {}

    expect(isApplicationScoped(MyBean)).toBe(true);
  });

  it("undecorated class is not scoped", () => {
    class Plain {}

    expect(isApplicationScoped(Plain)).toBe(false);
  });
});

describe("@Observes", () => {
  it("registers a method for a topic", () => {
    class Bean {
      @Observes("orders:new")
      onOrder(_event: unknown) {}
    }

    const observers = getObservers(Bean.prototype);
    expect(observers).toEqual([
      { topic: "orders:new", methodName: "onOrder" },
    ]);
  });

  it("supports multiple @Observes on the same method", () => {
    class Bean {
      @Observes("a:topic")
      @Observes("b:topic")
      onBoth(_event: unknown) {}
    }

    const observers = getObservers(Bean.prototype);
    expect(observers).toHaveLength(2);
    expect(observers).toContainEqual({ topic: "a:topic", methodName: "onBoth" });
    expect(observers).toContainEqual({ topic: "b:topic", methodName: "onBoth" });
  });

  it("collects observers from multiple methods", () => {
    class Bean {
      @Observes("a:topic")
      onA(_event: unknown) {}

      @Observes("b:topic")
      onB(_event: unknown) {}
    }

    const observers = getObservers(Bean.prototype);
    expect(observers).toHaveLength(2);
  });
});

describe("@Publish", () => {
  it("registers a method as a publisher", () => {
    class Bean {
      @Publish("alerts:fire")
      sendAlert() {
        return { level: "critical" };
      }
    }

    const publishers = getPublishers(Bean.prototype);
    expect(publishers).toEqual([
      { topic: "alerts:fire", methodName: "sendAlert" },
    ]);
  });
});
