import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEventConnection } from "./event-connection.js";
import type { PushSourceConfig } from "./push-source.js";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = 3; // CLOSED
  }

  simulateOpen(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(data: string): void {
    this.onmessage?.({ data });
  }

  simulateClose(code = 1006, reason = ""): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

let origWS: typeof WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  origWS = globalThis.WebSocket;
  (globalThis as Record<string, unknown>).WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  (globalThis as Record<string, unknown>).WebSocket = origWS;
});

function lastWs(): MockWebSocket {
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  if (!ws) throw new Error("No WebSocket instance found");
  return ws;
}

describe("createEventConnection", () => {
  it("establishes WebSocket and reports connected", () => {
    const conn = createEventConnection("wss://example.com/ws");
    expect(conn.connected).toBe(false);
    lastWs().simulateOpen();
    expect(conn.connected).toBe(true);
    conn.close();
  });

  it("listen sends wire op when connected", () => {
    const conn = createEventConnection("wss://example.com/ws");
    lastWs().simulateOpen();
    conn.listen(["debate:abc", "file:/x"]);
    const sent = lastWs().sent[0];
    if (!sent) throw new Error("No message sent");
    expect(JSON.parse(sent)).toEqual({
      op: "listen",
      topics: ["debate:abc", "file:/x"],
    });
    conn.close();
  });

  it("listen queued before connect is sent on open", () => {
    const conn = createEventConnection("wss://example.com/ws");
    conn.listen(["debate:abc"]);
    expect(lastWs().sent.length).toBe(0);
    lastWs().simulateOpen();
    expect(lastWs().sent.length).toBe(1);
    const sent = lastWs().sent[0];
    if (!sent) throw new Error("No message sent");
    expect(JSON.parse(sent)).toEqual({
      op: "listen",
      topics: ["debate:abc"],
    });
    conn.close();
  });

  it("unlisten sends wire op", () => {
    const conn = createEventConnection("wss://example.com/ws");
    lastWs().simulateOpen();
    conn.listen(["debate:abc"]);
    conn.unlisten(["debate:abc"]);
    const sent = lastWs().sent[1];
    if (!sent) throw new Error("No message sent");
    expect(JSON.parse(sent)).toEqual({
      op: "unlisten",
      topics: ["debate:abc"],
    });
    conn.close();
  });

  it("send forwards arbitrary JSON", () => {
    const conn = createEventConnection("wss://example.com/ws");
    lastWs().simulateOpen();
    conn.send({ custom: "data" });
    const sent = lastWs().sent[0];
    if (!sent) throw new Error("No message sent");
    expect(JSON.parse(sent)).toEqual({ custom: "data" });
    conn.close();
  });

  it("incoming event dispatches CustomEvent on eventTarget", () => {
    const target = new EventTarget();
    const handler = vi.fn();
    target.addEventListener("pages-event", handler);
    const conn = createEventConnection("wss://example.com/ws", {
      eventTarget: target as unknown as HTMLElement,
    });
    lastWs().simulateOpen();
    lastWs().simulateMessage(JSON.stringify({
      op: "event",
      topic: "debate:abc",
      payload: { text: "hello" },
    }));
    expect(handler).toHaveBeenCalledTimes(1);
    const firstCall = handler.mock.calls[0];
    if (!firstCall) throw new Error("Handler not called");
    const detail = (firstCall[0] as CustomEvent).detail;
    expect(detail.topic).toBe("debate:abc");
    expect(detail.payload).toEqual({ text: "hello" });
    conn.close();
  });

  it("batch array-wrapped events dispatch multiple events", () => {
    const target = new EventTarget();
    const handler = vi.fn();
    target.addEventListener("pages-event", handler);
    const conn = createEventConnection("wss://example.com/ws", {
      eventTarget: target as unknown as HTMLElement,
    });
    lastWs().simulateOpen();
    lastWs().simulateMessage(JSON.stringify([
      { op: "event", topic: "a", payload: 1 },
      { op: "event", topic: "b", payload: 2 },
    ]));
    expect(handler).toHaveBeenCalledTimes(2);
    conn.close();
  });

  it("non-event ops are silently ignored", () => {
    const target = new EventTarget();
    const handler = vi.fn();
    target.addEventListener("pages-event", handler);
    const conn = createEventConnection("wss://example.com/ws", {
      eventTarget: target as unknown as HTMLElement,
    });
    lastWs().simulateOpen();
    lastWs().simulateMessage(JSON.stringify({
      op: "snapshot",
      dataset: "x",
      columns: [],
      rows: [],
    }));
    expect(handler).not.toHaveBeenCalled();
    conn.close();
  });

  it("reconnection re-sends listen registrations", () => {
    vi.useFakeTimers();
    const conn = createEventConnection("wss://example.com/ws");
    lastWs().simulateOpen();
    conn.listen(["debate:abc"]);
    const firstSent = lastWs().sent.length;
    lastWs().simulateClose(1006);
    vi.advanceTimersByTime(1500);
    const reconnectedWs = lastWs();
    reconnectedWs.simulateOpen();
    const sent = reconnectedWs.sent[0];
    if (!sent) throw new Error("No message sent");
    const listenMsg = JSON.parse(sent);
    expect(listenMsg).toEqual({ op: "listen", topics: ["debate:abc"] });
    conn.close();
    vi.useRealTimers();
  });

  it("close tears down cleanly with no reconnection", () => {
    vi.useFakeTimers();
    const conn = createEventConnection("wss://example.com/ws");
    lastWs().simulateOpen();
    conn.close();
    expect(conn.connected).toBe(false);
    const countBefore = MockWebSocket.instances.length;
    vi.advanceTimersByTime(60000);
    expect(MockWebSocket.instances.length).toBe(countBefore);
    vi.useRealTimers();
  });

  it("applies relay config to connection URL", () => {
    const conn = createEventConnection("wss://example.com/ws", {
      relay: { endpoint: "wss://relay.example.com/proxy" },
    });
    expect(lastWs().url).toContain("relay.example.com");
    expect(lastWs().url).toContain("target=");
    conn.close();
  });

  it("applies auth config to connection URL", () => {
    const conn = createEventConnection("wss://example.com/ws", {
      auth: { type: "query-param", token: "abc123" },
    });
    expect(lastWs().url).toContain("token=abc123");
    conn.close();
  });
});
