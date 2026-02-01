import { describe, expect, test } from "bun:test";
import { WS_EVENTS } from "./events";

describe("WS_EVENTS", () => {
  test("should have all client events", () => {
    expect(WS_EVENTS.ROOM_CREATE).toBe("room.create");
    expect(WS_EVENTS.ROOM_JOIN).toBe("room.join");
    expect(WS_EVENTS.GAME_SUBMIT_CANDIDATES).toBe("game.submitCandidates");
  });

  test("should have all server events", () => {
    expect(WS_EVENTS.ROOM_CREATED).toBe("room.created");
    expect(WS_EVENTS.ROOM_JOINED).toBe("room.joined");
    expect(WS_EVENTS.ROOM_ERROR).toBe("room.error");
    expect(WS_EVENTS.GAME_START).toBe("game.start");
    expect(WS_EVENTS.GAME_STATE).toBe("game.state");
    expect(WS_EVENTS.GAME_TURN_RESULT).toBe("game.turnResult");
    expect(WS_EVENTS.GAME_ERROR).toBe("game.error");
  });
});
