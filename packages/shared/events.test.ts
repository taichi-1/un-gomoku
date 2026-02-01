import { describe, expect, test } from "bun:test";
import { WS_EVENTS } from "./events";

describe("WS_EVENTS", () => {
  test("should have all client events", () => {
    expect(WS_EVENTS.ROOM_CREATE).toBe("room.create");
    expect(WS_EVENTS.ROOM_JOIN).toBe("room.join");
    expect(WS_EVENTS.GAME_SUBMIT_CANDIDATES).toBe("game.submitCandidates");
    expect(WS_EVENTS.GAME_UNDO_REQUEST).toBe("game.undo.request");
    expect(WS_EVENTS.GAME_UNDO_ACCEPT).toBe("game.undo.accept");
    expect(WS_EVENTS.GAME_UNDO_REJECT).toBe("game.undo.reject");
  });

  test("should have all server events", () => {
    expect(WS_EVENTS.ROOM_CREATED).toBe("room.created");
    expect(WS_EVENTS.ROOM_JOINED).toBe("room.joined");
    expect(WS_EVENTS.ROOM_ERROR).toBe("room.error");
    expect(WS_EVENTS.ROOM_OPPONENT_OFFLINE).toBe("room.opponentOffline");
    expect(WS_EVENTS.ROOM_OPPONENT_ONLINE).toBe("room.opponentOnline");
    expect(WS_EVENTS.GAME_START).toBe("game.start");
    expect(WS_EVENTS.GAME_STATE).toBe("game.state");
    expect(WS_EVENTS.GAME_TURN_RESULT).toBe("game.turnResult");
    expect(WS_EVENTS.GAME_UNDO_PENDING).toBe("game.undo.pending");
    expect(WS_EVENTS.GAME_UNDO_APPLIED).toBe("game.undo.applied");
    expect(WS_EVENTS.GAME_UNDO_REJECTED).toBe("game.undo.rejected");
    expect(WS_EVENTS.GAME_ERROR).toBe("game.error");
  });
});
