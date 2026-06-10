import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { encodeBoard } from "./features";
import { cellIndex, flattenBoard } from "./types";

const FIXTURE_PATH = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "ml",
  "tests",
  "fixtures",
  "encoding-vectors.json",
);

interface EncodingCase {
  name: string;
  board: string;
  toMove: "player1" | "player2";
  planes: number[];
}

function boardFromString(text: string): Int8Array {
  const flat = new Int8Array(225);
  for (let i = 0; i < 225; i++) {
    const char = text[i];
    flat[i] = char === "1" ? 1 : char === "2" ? 2 : 0;
  }
  return flat;
}

describe("encodeBoard", () => {
  test("matches the Python-generated parity fixture", async () => {
    const data = (await Bun.file(FIXTURE_PATH).json()) as {
      cases: EncodingCase[];
    };
    expect(data.cases.length).toBeGreaterThan(0);
    for (const testCase of data.cases) {
      const board = boardFromString(testCase.board);
      const toMove = testCase.toMove === "player1" ? 1 : 2;
      const planes = encodeBoard(board, toMove);
      expect(planes.length).toBe(testCase.planes.length);
      for (let i = 0; i < planes.length; i++) {
        if (planes[i] !== testCase.planes[i]) {
          throw new Error(
            `${testCase.name}: plane mismatch at index ${i}: ` +
              `${planes[i]} != ${testCase.planes[i]}`,
          );
        }
      }
    }
  });

  test("perspective flip swaps the stone planes", () => {
    const board = new Int8Array(225);
    board[cellIndex(3, 7)] = 1;
    board[cellIndex(14, 0)] = 2;
    const p1View = encodeBoard(board, 1);
    const p2View = encodeBoard(board, 2);
    expect(p1View[cellIndex(3, 7)]).toBe(1);
    expect(p2View[225 + cellIndex(3, 7)]).toBe(1);
    expect(p1View[225 + cellIndex(14, 0)]).toBe(1);
    expect(p2View[cellIndex(14, 0)]).toBe(1);
  });
});

describe("flattenBoard", () => {
  test("maps BoardState to row-major Int8Array", () => {
    const board: (null | "player1" | "player2")[][] = Array.from(
      { length: 15 },
      () => Array.from({ length: 15 }, () => null),
    );
    board[7]?.splice(3, 1, "player1");
    board[0]?.splice(14, 1, "player2");
    const flat = flattenBoard(board);
    expect(flat[cellIndex(3, 7)]).toBe(1);
    expect(flat[cellIndex(14, 0)]).toBe(2);
    expect(flat[cellIndex(0, 0)]).toBe(0);
  });
});
