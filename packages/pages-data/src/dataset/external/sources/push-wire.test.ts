import { describe, it, expect, vi } from "vitest";
import { buildConnectionUrl, sendListen, sendUnlisten, dispatchWireEvent } from "./push-wire.js";

describe("buildConnectionUrl", () => {
  it("returns URL unchanged when no config", () => {
    expect(buildConnectionUrl("wss://example.com/ws")).toBe("wss://example.com/ws");
  });

  it("rewrites URL through relay endpoint", () => {
    const result = buildConnectionUrl("wss://example.com/ws", {
      relay: { endpoint: "wss://relay.example.com/proxy" },
    });
    const url = new URL(result);
    expect(url.origin).toBe("wss://relay.example.com");
    expect(url.pathname).toBe("/proxy");
    expect(url.searchParams.get("target")).toBe("wss://example.com/ws");
  });

  it("appends auth token as query parameter", () => {
    const result = buildConnectionUrl("wss://example.com/ws", {
      auth: { type: "query-param" as const, token: "abc123" },
    });
    const url = new URL(result);
    expect(url.searchParams.get("token")).toBe("abc123");
  });

  it("uses custom param name for auth", () => {
    const result = buildConnectionUrl("wss://example.com/ws", {
      auth: { type: "query-param" as const, paramName: "key", token: "abc123" },
    });
    const url = new URL(result);
    expect(url.searchParams.get("key")).toBe("abc123");
  });

  it("applies both relay and auth", () => {
    const result = buildConnectionUrl("wss://example.com/ws", {
      relay: { endpoint: "wss://relay.example.com/proxy" },
      auth: { type: "query-param" as const, token: "abc123" },
    });
    const url = new URL(result);
    expect(url.searchParams.get("target")).toBe("wss://example.com/ws");
    expect(url.searchParams.get("token")).toBe("abc123");
  });
});

describe("sendListen", () => {
  it("sends listen op with topics", () => {
    const send = vi.fn();
    const ws = { send, readyState: 1 } as unknown as WebSocket;
    sendListen(ws, ["debate:abc", "file:/x"]);
    expect(send).toHaveBeenCalledWith(
      JSON.stringify({ op: "listen", topics: ["debate:abc", "file:/x"] }),
    );
  });
});

describe("sendUnlisten", () => {
  it("sends unlisten op with topics", () => {
    const send = vi.fn();
    const ws = { send, readyState: 1 } as unknown as WebSocket;
    sendUnlisten(ws, ["debate:abc"]);
    expect(send).toHaveBeenCalledWith(
      JSON.stringify({ op: "unlisten", topics: ["debate:abc"] }),
    );
  });
});

describe("dispatchWireEvent", () => {
  it("dispatches pages-event CustomEvent with topic and payload", () => {
    const target = new EventTarget();
    const handler = vi.fn();
    target.addEventListener("pages-event", handler);
    dispatchWireEvent({ topic: "debate:abc", payload: { text: "hi" } }, target);
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(detail.topic).toBe("debate:abc");
    expect(detail.payload).toEqual({ text: "hi" });
  });

  it("does not dispatch when topic is missing", () => {
    const target = new EventTarget();
    const handler = vi.fn();
    target.addEventListener("pages-event", handler);
    dispatchWireEvent({ payload: { text: "hi" } }, target);
    expect(handler).not.toHaveBeenCalled();
  });
});
