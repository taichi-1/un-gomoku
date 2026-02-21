const FALLBACK_WS_ENDPOINT = "ws://localhost:3000/ws";

export function getWebSocketEndpoint(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;

  if (fromEnv?.startsWith("ws://") || fromEnv?.startsWith("wss://")) {
    return fromEnv;
  }

  if (typeof window === "undefined") {
    return FALLBACK_WS_ENDPOINT;
  }

  if (fromEnv?.startsWith("/")) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${fromEnv}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function buildRoomShareUrl(roomId: string): string {
  if (typeof window === "undefined") {
    return `/online/${roomId}`;
  }

  return `${window.location.origin}/online/${roomId}`;
}
