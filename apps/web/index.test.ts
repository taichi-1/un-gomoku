import { describe, expect, test } from "bun:test";
import {
  BOARD_SIZE,
  MAX_CANDIDATES,
  SUCCESS_PROBABILITY,
} from "@pkg/shared/constants";
import { WS_EVENTS } from "@pkg/shared/events";

describe("@pkg/shared imports", () => {
  test("should import BOARD_SIZE correctly", () => {
    expect(BOARD_SIZE).toBe(15);
  });

  test("should import MAX_CANDIDATES correctly", () => {
    expect(MAX_CANDIDATES).toBe(5);
  });

  test("should import SUCCESS_PROBABILITY correctly", () => {
    expect(SUCCESS_PROBABILITY[1]).toBe(0.5);
    expect(SUCCESS_PROBABILITY[5]).toBe(0.9);
  });

  test("should import WS_EVENTS correctly", () => {
    expect(WS_EVENTS.ROOM_CREATE).toBe("room.create");
    expect(WS_EVENTS.GAME_START).toBe("game.start");
  });
});
