import type { PushSourceConfig } from "./push-source.js";
import { buildConnectionUrl, sendListen, sendUnlisten, dispatchWireEvent } from "./push-wire.js";

export interface EventConnection {
  send(message: object): void;
  listen(topics: string[]): void;
  unlisten(topics: string[]): void;
  close(): void;
  readonly connected: boolean;
}

export function createEventConnection(
  url: string,
  config?: PushSourceConfig,
): EventConnection {
  let ws: WebSocket | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  const listenRegistrations = new Set<string>();

  const connectionUrl = buildConnectionUrl(url, config);

  function connect(): void {
    if (closed) return;
    ws = new WebSocket(connectionUrl);

    ws.onopen = () => {
      reconnectAttempt = 0;
      if (listenRegistrations.size > 0 && ws) {
        sendListen(ws, [...listenRegistrations]);
      }
    };

    ws.onmessage = (e: MessageEvent) => {
      handleMessage(e.data as string);
    };

    ws.onclose = (e: CloseEvent) => {
      if (closed) return;
      if (e.code >= 4000) return;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
      reconnectAttempt++;
      reconnectTimer = setTimeout(connect, delay);
    };

    ws.onerror = () => {};
  }

  function handleMessage(data: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      console.warn("[EventConnection] Failed to parse message:", data);
      return;
    }
    const messages = Array.isArray(parsed) ? (parsed as unknown[]) : [parsed];
    for (const msg of messages) {
      if (typeof msg === "object" && msg !== null
          && (msg as Record<string, unknown>).op === "event"
          && config?.eventTarget) {
        dispatchWireEvent(msg as { topic?: string; payload?: unknown }, config.eventTarget);
      }
    }
  }

  connect();

  return {
    get connected() { return !closed && ws?.readyState === 1; },

    send(message: object): void {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(message));
      }
    },

    listen(topics: string[]): void {
      for (const t of topics) {
        listenRegistrations.add(t);
      }
      if (ws && ws.readyState === 1) {
        sendListen(ws, topics);
      }
    },

    unlisten(topics: string[]): void {
      for (const t of topics) {
        listenRegistrations.delete(t);
      }
      if (ws && ws.readyState === 1) {
        sendUnlisten(ws, topics);
      }
    },

    close(): void {
      closed = true;
      listenRegistrations.clear();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close(1000, "client closed");
      ws = null;
    },
  };
}
