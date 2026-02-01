import { describe, expect, test } from "bun:test";
import { generateRoomId } from "./room-id";

describe("generateRoomId", () => {
  test("generates deterministic ID when random is injected", () => {
    expect(generateRoomId(() => 0)).toBe("AAAAAA");
  });

  test("generates a 6-character room ID", () => {
    expect(generateRoomId().length).toBe(6);
  });

  test("only contains uppercase letters and digits", () => {
    expect(generateRoomId()).toMatch(/^[A-Z0-9]{6}$/);
  });

  test("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateRoomId());
    }
    expect(ids.size).toBeGreaterThan(90);
  });
});
