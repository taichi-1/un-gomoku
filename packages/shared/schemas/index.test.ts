import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import { BOARD_SIZE } from "../constants";
import { CoordinateSchema, parseClientMessage } from "./index";

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

    test("should parse valid room.join message with playerToken", () => {
      const result = parseClientMessage({
        event: "room.join",
        roomId: "ABC123",
        playerToken: "token123",
      });
      expect(result.success).toBe(true);
      if (result.success && result.output.event === "room.join") {
        expect(result.output.playerToken).toBe("token123");
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

  describe("game.undo", () => {
    test("should parse valid game.undo.request message", () => {
      const result = parseClientMessage({
        event: "game.undo.request",
      });
      expect(result.success).toBe(true);
    });

    test("should parse valid game.undo.accept message", () => {
      const result = parseClientMessage({
        event: "game.undo.accept",
      });
      expect(result.success).toBe(true);
    });

    test("should parse valid game.undo.reject message", () => {
      const result = parseClientMessage({
        event: "game.undo.reject",
      });
      expect(result.success).toBe(true);
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
