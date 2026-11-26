import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplicationScoped, Observes, Publish } from "./decorators.js";
import { EventContainer } from "./event-container.js";

const { mockConnect, mockDisconnect, mockStreamInstances } = vi.hoisted(() => {
  return {
    mockConnect: vi.fn(),
    mockDisconnect: vi.fn(),
    mockStreamInstances: [] as any[],
  };
});

vi.mock("@casehubio/pages-data", () => {
  return {
    EventStream: vi.fn().mockImplementation(function (
      this: any,
      _url: string,
      topics: string | string[],
      options?: any,
    ) {
      this.topics = Array.isArray(topics) ? topics : [topics];
      this._onChange = options?.onChange;
      this._latest = undefined;
      this.connect = mockConnect;
      this.disconnect = mockDisconnect;
      Object.defineProperty(this, "latest", {
        get: () => this._latest,
      });
      mockStreamInstances.push(this);
    }),
    matchesTopic: (pattern: string, topic: string) => pattern === topic,
    isValidTopicOrPattern: () => true,
  };
});

describe("EventContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamInstances.length = 0;
  });

  it("rejects undecorated classes", () => {
    class Plain {}

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    expect(() => container.register(Plain)).toThrow(
      /not decorated with @ApplicationScoped/,
    );
  });

  it("accepts @ApplicationScoped classes", () => {
    @ApplicationScoped
    class Bean {}

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    expect(() => container.register(Bean)).not.toThrow();
  });

  it("instantiates singletons on start", () => {
    @ApplicationScoped
    class Bean {
      started = true;
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Bean);
    container.start();

    const instance = container.getInstance(Bean);
    expect(instance).toBeInstanceOf(Bean);
    expect(instance.started).toBe(true);
  });

  it("returns same singleton on repeated getInstance", () => {
    @ApplicationScoped
    class Bean {}

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Bean);
    container.start();

    expect(container.getInstance(Bean)).toBe(container.getInstance(Bean));
  });

  it("creates EventStream and connects on start", () => {
    @ApplicationScoped
    class Handler {
      @Observes("orders:new")
      onOrder(_event: unknown) {}
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Handler);
    container.start();

    expect(mockStreamInstances).toHaveLength(1);
    expect(mockStreamInstances[0]!.topics).toContain("orders:new");
    expect(mockConnect).toHaveBeenCalled();
  });

  it("routes events to @Observes methods", () => {
    const received: unknown[] = [];

    @ApplicationScoped
    class Handler {
      @Observes("orders:new")
      onOrder(event: unknown) {
        received.push(event);
      }
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Handler);
    container.start();

    const stream = mockStreamInstances[0]!;
    stream._latest = { topic: "orders:new", payload: { item: "widget" } };
    stream._onChange();

    expect(received).toEqual([{ item: "widget" }]);
  });

  it("does not create stream when no @Observes methods", () => {
    @ApplicationScoped
    class NoObservers {}

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(NoObservers);
    container.start();

    expect(mockStreamInstances).toHaveLength(0);
  });

  it("stop disconnects streams and clears singletons", () => {
    @ApplicationScoped
    class Bean {
      @Observes("test:topic")
      onTest(_event: unknown) {}
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Bean);
    container.start();
    container.stop();

    expect(mockDisconnect).toHaveBeenCalled();
    expect(() => container.getInstance(Bean)).toThrow();
  });

  it("double start is a no-op", () => {
    @ApplicationScoped
    class Bean {
      @Observes("test:topic")
      onTest(_event: unknown) {}
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Bean);
    container.start();
    container.start();

    expect(mockStreamInstances).toHaveLength(1);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("register after start throws", () => {
    @ApplicationScoped
    class Bean {}

    @ApplicationScoped
    class Late {}

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Bean);
    container.start();

    expect(() => container.register(Late)).toThrow(/Cannot register after/);
  });

  it("can restart after stop", () => {
    @ApplicationScoped
    class Bean {
      @Observes("test:topic")
      onTest(_event: unknown) {}
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Bean);
    container.start();
    container.stop();
    container.start();

    expect(container.getInstance(Bean)).toBeInstanceOf(Bean);
    expect(mockStreamInstances).toHaveLength(2);
  });
});

describe("@Publish wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamInstances.length = 0;
  });

  it("publishes return value via fetch", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ seq: 1 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    @ApplicationScoped
    class Publisher {
      @Publish("alerts:fire")
      sendAlert() {
        return { level: "critical" };
      }
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Publisher);
    container.start();

    const instance = container.getInstance(Publisher);
    const result = await (instance.sendAlert as any)();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://test/api/push/publish/alerts:fire",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: "critical" }),
      }),
    );
    expect(result).toEqual({ seq: 1 });

    vi.unstubAllGlobals();
  });

  it("skips publish when method returns null", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    @ApplicationScoped
    class Publisher {
      @Publish("alerts:fire")
      sendNothing() {
        return null;
      }
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
    });
    container.register(Publisher);
    container.start();

    const instance = container.getInstance(Publisher);
    await (instance.sendNothing as any)();

    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("includes auth header when configured", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ seq: 2 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    @ApplicationScoped
    class Publisher {
      @Publish("alerts:fire")
      sendAlert() {
        return { level: "warning" };
      }
    }

    const container = new EventContainer({
      wsUrl: "ws://test/push",
      publishBaseUrl: "http://test",
      auth: { token: "my-token" },
    });
    container.register(Publisher);
    container.start();

    const instance = container.getInstance(Publisher);
    await (instance.sendAlert as any)();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://test/api/push/publish/alerts:fire",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer my-token",
        },
      }),
    );

    vi.unstubAllGlobals();
  });
});
