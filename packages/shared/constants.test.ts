import { describe, expect, test } from "bun:test";
import {
  BOARD_SIZE,
  MAX_CANDIDATES,
  SUCCESS_PROBABILITY,
  WIN_LENGTH,
} from "./constants";

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
