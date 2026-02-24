export interface LogEventParams {
  event: string;
  roomId: string;
  playerId: string | null;
  result: "ok" | "error";
  errorCode?: string | null;
}

export function logEvent(params: LogEventParams): void {
  console.log(
    JSON.stringify({
      event: params.event,
      roomId: params.roomId,
      playerId: params.playerId,
      result: params.result,
      errorCode: params.errorCode ?? null,
    }),
  );
}
