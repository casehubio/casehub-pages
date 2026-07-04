export function buildConnectionUrl(
  baseUrl: string,
  config?: {
    relay?: { endpoint: string };
    auth?: { type: "query-param"; paramName?: string; token: string };
  },
): string {
  let url = new URL(baseUrl);
  if (config?.relay) {
    url = new URL(config.relay.endpoint);
    url.searchParams.set("target", baseUrl);
  }
  if (config?.auth?.type === "query-param") {
    url.searchParams.set(config.auth.paramName ?? "token", config.auth.token);
  }
  return url.toString();
}

export function sendListen(ws: WebSocket, topics: string[]): void {
  ws.send(JSON.stringify({ op: "listen", topics }));
}

export function sendUnlisten(ws: WebSocket, topics: string[]): void {
  ws.send(JSON.stringify({ op: "unlisten", topics }));
}

export function dispatchWireEvent(
  msg: { topic?: string; payload?: unknown },
  eventTarget: EventTarget,
): void {
  if (msg.topic) {
    eventTarget.dispatchEvent(new CustomEvent("pages-event", {
      bubbles: true,
      composed: true,
      detail: { topic: msg.topic, payload: msg.payload },
    }));
  }
}
