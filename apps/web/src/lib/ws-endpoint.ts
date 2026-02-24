function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function getHttpBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (fromEnv && /^https?:\/\//.test(fromEnv)) {
    return normalizeBaseUrl(fromEnv);
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:8787";
}

export function getWebSocketEndpoint(roomId: string): string {
  const base = getHttpBaseUrl();
  const wsBase = base.startsWith("https://")
    ? `wss://${base.slice("https://".length)}`
    : base.startsWith("http://")
      ? `ws://${base.slice("http://".length)}`
      : base;
  return `${wsBase}/ws/${encodeURIComponent(roomId)}`;
}

export function buildRoomShareUrl(roomId: string): string {
  if (typeof window === "undefined") {
    return `/online/${roomId}`;
  }

  return `${window.location.origin}/online/${roomId}`;
}
