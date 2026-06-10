/**
 * JSONL stdio opponent for ml/ arena evaluation.
 *
 * Wraps the legacy expectiminimax CPU (frozen under src/baseline/) so trained
 * nets can be gated against it. One request per line on stdin:
 *   {"board": "<225 chars '.'|'1'|'2'>", "player": "player1"|"player2",
 *    "difficulty"?: "easy"|"medium"|"hard", "persona"?: "attacker"|...}
 * One response per line on stdout:
 *   {"candidates": [[x, y], ...]}
 *
 * Usage: bun run tools/parity-arena/src/ts-opponent.ts
 */

import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, CellState, PlayerId } from "@pkg/shared/schemas";
import {
  CPU_CONFIGS,
  CPU_PERSONA_CONFIGS,
  type CpuDifficulty,
  type CpuPersona,
} from "./baseline/config";
import { computeBestMove } from "./baseline/expectiminimax";

interface MoveRequest {
  board: string;
  player: PlayerId;
  difficulty?: CpuDifficulty;
  persona?: CpuPersona;
}

function parseBoard(text: string): BoardState {
  if (text.length !== BOARD_SIZE * BOARD_SIZE) {
    throw new Error(`board must be ${BOARD_SIZE * BOARD_SIZE} chars`);
  }
  const board: BoardState = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: CellState[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const char = text[y * BOARD_SIZE + x];
      row.push(char === "1" ? "player1" : char === "2" ? "player2" : null);
    }
    board.push(row);
  }
  return board;
}

for await (const line of console) {
  const trimmed = line.trim();
  if (trimmed.length === 0) continue;
  const request = JSON.parse(trimmed) as MoveRequest;
  const config = {
    ...CPU_CONFIGS[request.difficulty ?? "hard"],
    ...CPU_PERSONA_CONFIGS[request.persona ?? "attacker"],
  };
  const { candidates } = computeBestMove(
    parseBoard(request.board),
    request.player,
    config,
  );
  console.log(
    JSON.stringify({ candidates: candidates.map((c) => [c.x, c.y]) }),
  );
}
