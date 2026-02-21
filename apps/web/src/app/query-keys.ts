import type { GameMode } from "@/features/game/types/game-session";

export function gameSessionQueryKey(
  mode: GameMode,
  roomId: string | null,
): readonly ["game-session", GameMode, string] {
  return ["game-session", mode, roomId ?? "local"];
}
