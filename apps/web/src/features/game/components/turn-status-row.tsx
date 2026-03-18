import type { PlayerId } from "@pkg/shared/schemas";
import { SharePanel } from "@/features/game/components/share-panel";
import { TurnIndicator } from "@/features/game/components/turn-indicator";
import type { GameSessionSnapshot } from "@/features/game/types/game-session";

interface TurnStatusRowProps {
  snapshot: GameSessionSnapshot;
  showFinishedResult: boolean;
  displayPlayerId: PlayerId;
  hasActiveFx: boolean;
}

export function TurnStatusRow({
  snapshot,
  showFinishedResult,
  displayPlayerId,
  hasActiveFx,
}: TurnStatusRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <TurnIndicator
        snapshot={snapshot}
        showFinishedResult={showFinishedResult}
        displayPlayerId={displayPlayerId}
        hasActiveFx={hasActiveFx}
      />
      {snapshot.mode === "online" ? (
        <SharePanel
          roomId={snapshot.roomId}
          shareUrl={snapshot.shareUrl}
          status={snapshot.status}
          statusMessage={snapshot.statusMessage}
        />
      ) : null}
    </div>
  );
}
