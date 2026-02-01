import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import {
  BOARD_SIZE,
  MAX_CANDIDATES,
  SUCCESS_PROBABILITY,
  WIN_LENGTH,
} from "./constants";
import { WS_EVENTS } from "./events";
import { CoordinateSchema, parseClientMessage } from "./schemas";

describe("Constants", () => {
  test("BOARD_SIZE should be 15", () => {
    expect(BOARD_SIZE).toBe(15);
  });

  test("MAX_CANDIDATES should be 5", () => {
    expect(MAX_CANDIDATES).toBe(5);
  });

  test("WIN_LENGTH should be 5", () => {
    expect(WIN_LENGTH).toBe(5);
  });

  test("SUCCESS_PROBABILITY should have correct values for 1-5 candidates", () => {
    expect(SUCCESS_PROBABILITY[1]).toBe(0.5);
    expect(SUCCESS_PROBABILITY[2]).toBe(0.6);
    expect(SUCCESS_PROBABILITY[3]).toBe(0.7);
    expect(SUCCESS_PROBABILITY[4]).toBe(0.8);
    expect(SUCCESS_PROBABILITY[5]).toBe(0.9);
  });

  test("SUCCESS_PROBABILITY should increase with more candidates", () => {
    for (let i = 1; i < MAX_CANDIDATES; i++) {
      const current = SUCCESS_PROBABILITY[i];
      const next = SUCCESS_PROBABILITY[i + 1];
      if (current !== undefined && next !== undefined) {
        expect(current).toBeLessThan(next);
      }
    }
  });
});

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

describe("CoordinateSchema", () => {
  test("should accept valid coordinates", () => {
    expect(v.safeParse(CoordinateSchema, { x: 0, y: 0 }).success).toBe(true);
    expect(v.safeParse(CoordinateSchema, { x: 7, y: 7 }).success).toBe(true);
    expect(
      v.safeParse(CoordinateSchema, { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 })
        .success,
    ).toBe(true);
  });

  test("should reject negative coordinates", () => {
    expect(v.safeParse(CoordinateSchema, { x: -1, y: 0 }).success).toBe(false);
    expect(v.safeParse(CoordinateSchema, { x: 0, y: -1 }).success).toBe(false);
  });

  test("should reject out-of-bounds coordinates", () => {
    expect(v.safeParse(CoordinateSchema, { x: BOARD_SIZE, y: 0 }).success).toBe(
      false,
    );
    expect(v.safeParse(CoordinateSchema, { x: 0, y: BOARD_SIZE }).success).toBe(
      false,
    );
  });

  test("should reject non-integer coordinates", () => {
    expect(v.safeParse(CoordinateSchema, { x: 1.5, y: 0 }).success).toBe(false);
    expect(v.safeParse(CoordinateSchema, { x: 0, y: 2.7 }).success).toBe(false);
  });

  test("should reject non-numeric values", () => {
    expect(v.safeParse(CoordinateSchema, { x: "0", y: 0 }).success).toBe(false);
    expect(v.safeParse(CoordinateSchema, { x: 0, y: null }).success).toBe(
      false,
    );
  });
});

describe("parseClientMessage", () => {
  describe("room.create", () => {
    test("should parse valid room.create message", () => {
      const result = parseClientMessage({ event: "room.create" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.event).toBe("room.create");
      }
    });
  });

  describe("room.join", () => {
    test("should parse valid room.join message", () => {
      const result = parseClientMessage({
        event: "room.join",
        roomId: "ABC123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.event).toBe("room.join");
        if (result.output.event === "room.join") {
          expect(result.output.roomId).toBe("ABC123");
        }
      }
    });

    test("should reject room.join with empty roomId", () => {
      const result = parseClientMessage({ event: "room.join", roomId: "" });
      expect(result.success).toBe(false);
    });

    test("should reject room.join without roomId", () => {
      const result = parseClientMessage({ event: "room.join" });
      expect(result.success).toBe(false);
    });
  });

  describe("game.submitCandidates", () => {
    test("should parse valid submitCandidates with 1 candidate", () => {
      const result = parseClientMessage({
        event: "game.submitCandidates",
        candidates: [{ x: 7, y: 7 }],
      });
      expect(result.success).toBe(true);
      if (result.success && result.output.event === "game.submitCandidates") {
        expect(result.output.candidates).toHaveLength(1);
      }
    });

    test("should parse valid submitCandidates with 5 candidates", () => {
      const result = parseClientMessage({
        event: "game.submitCandidates",
        candidates: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
          { x: 4, y: 4 },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success && result.output.event === "game.submitCandidates") {
        expect(result.output.candidates).toHaveLength(5);
      }
    });

    test("should reject submitCandidates with empty candidates array", () => {
      const result = parseClientMessage({
        event: "game.submitCandidates",
        candidates: [],
      });
      expect(result.success).toBe(false);
    });

    test("should reject submitCandidates with more than 5 candidates", () => {
      const result = parseClientMessage({
        event: "game.submitCandidates",
        candidates: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
          { x: 4, y: 4 },
          { x: 5, y: 5 },
        ],
      });
      expect(result.success).toBe(false);
    });

    test("should reject submitCandidates with invalid coordinates", () => {
      const result = parseClientMessage({
        event: "game.submitCandidates",
        candidates: [{ x: -1, y: 0 }],
      });
      expect(result.success).toBe(false);
    });

    test("should reject submitCandidates with out-of-bounds coordinates", () => {
      const result = parseClientMessage({
        event: "game.submitCandidates",
        candidates: [{ x: BOARD_SIZE, y: 0 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("invalid messages", () => {
    test("should reject unknown event", () => {
      const result = parseClientMessage({ event: "unknown.event" });
      expect(result.success).toBe(false);
    });

    test("should reject null", () => {
      const result = parseClientMessage(null);
      expect(result.success).toBe(false);
    });

    test("should reject undefined", () => {
      const result = parseClientMessage(undefined);
      expect(result.success).toBe(false);
    });

    test("should reject string", () => {
      const result = parseClientMessage("not an object");
      expect(result.success).toBe(false);
    });

    test("should reject object without event field", () => {
      const result = parseClientMessage({ roomId: "ABC123" });
      expect(result.success).toBe(false);
    });
  });
});
