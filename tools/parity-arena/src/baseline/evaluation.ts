import { placeStone } from "@pkg/core/board";
import { getNextPlayer } from "@pkg/core/game-state";
import { checkWinAt } from "@pkg/core/win-detection";
import { BOARD_SIZE } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import type { CpuConfig, CpuSituation } from "./config";

const DIRECTIONS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

const PATTERN_SCORE: readonly (readonly number[])[] = [
  [0, 0, 0],
  [0, 2, 10],
  [0, 14, 56],
  [0, 180, 900],
  [0, 5_500, 90_000],
  [1_000_000, 1_000_000, 1_000_000],
];

const REACH_SCORE = 42_000;
const SETUP_SCORE = 6_800;
const PRESSURE_SCORE = 900;
export const WIN_SCORE = 1_000_000;

interface RunInfo {
  count: number;
  openEnds: number;
}

interface WindowPatterns {
  wins: number;
  reaches: number;
  setups: number;
  pressure: number;
}

export interface MoveTactics {
  createsWin: boolean;
  blocksOpponentWin: boolean;
  createsReachCount: number;
  blocksOpponentReachCount: number;
  createsSetupCount: number;
  blocksOpponentSetupCount: number;
}

function patternScore(count: number, openEnds: number): number {
  if (count >= 5) return WIN_SCORE;
  return PATTERN_SCORE[count]?.[openEnds] ?? 0;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function cellAt(board: BoardState, x: number, y: number): string | null {
  return board[y]?.[x] ?? null;
}

function forEachRun(
  board: BoardState,
  player: PlayerId,
  iteratee: (run: RunInfo) => void,
): void {
  for (const [dx, dy] of DIRECTIONS) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (cellAt(board, x, y) !== player) continue;

        const prevX = x - dx;
        const prevY = y - dy;
        if (inBounds(prevX, prevY) && cellAt(board, prevX, prevY) === player) {
          continue;
        }

        let count = 0;
        let cx = x;
        let cy = y;
        while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
          count++;
          cx += dx;
          cy += dy;
        }

        let openEnds = 0;
        if (inBounds(cx, cy) && cellAt(board, cx, cy) === null) {
          openEnds++;
        }
        if (inBounds(prevX, prevY) && cellAt(board, prevX, prevY) === null) {
          openEnds++;
        }

        iteratee({ count, openEnds });
      }
    }
  }
}

function scoreRunsForPlayer(board: BoardState, player: PlayerId): number {
  let total = 0;
  forEachRun(board, player, ({ count, openEnds }) => {
    total += patternScore(count, openEnds);
  });
  return total;
}

function countStones(board: BoardState, player: PlayerId): number {
  let total = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y]?.[x] === player) {
        total++;
      }
    }
  }
  return total;
}

function collectWindowPatterns(
  board: BoardState,
  player: PlayerId,
): WindowPatterns {
  const opponent = getNextPlayer(player);
  const totals: WindowPatterns = {
    wins: 0,
    reaches: 0,
    setups: 0,
    pressure: 0,
  };

  for (const [dx, dy] of DIRECTIONS) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const endX = x + dx * 4;
        const endY = y + dy * 4;
        if (!inBounds(endX, endY)) continue;

        let playerCount = 0;
        let opponentCount = 0;
        let emptyCount = 0;

        for (let i = 0; i < 5; i++) {
          const cell = cellAt(board, x + dx * i, y + dy * i);
          if (cell === player) {
            playerCount++;
          } else if (cell === opponent) {
            opponentCount++;
          } else {
            emptyCount++;
          }
        }

        if (playerCount > 0 && opponentCount > 0) continue;
        if (playerCount === 5) {
          totals.wins++;
          continue;
        }
        if (opponentCount > 0) continue;
        if (playerCount === 4 && emptyCount === 1) {
          totals.reaches++;
        } else if (playerCount === 3 && emptyCount === 2) {
          totals.setups++;
        } else if (playerCount === 2 && emptyCount === 3) {
          totals.pressure++;
        }
      }
    }
  }

  return totals;
}

function collectWindowPatternsAt(
  board: BoardState,
  coord: Coordinate,
  player: PlayerId,
): WindowPatterns {
  const opponent = getNextPlayer(player);
  const totals: WindowPatterns = {
    wins: 0,
    reaches: 0,
    setups: 0,
    pressure: 0,
  };

  for (const [dx, dy] of DIRECTIONS) {
    for (let offset = -4; offset <= 0; offset++) {
      const startX = coord.x + dx * offset;
      const startY = coord.y + dy * offset;
      const endX = startX + dx * 4;
      const endY = startY + dy * 4;
      if (!inBounds(startX, startY) || !inBounds(endX, endY)) continue;

      let playerCount = 0;
      let opponentCount = 0;
      let emptyCount = 0;

      for (let i = 0; i < 5; i++) {
        const cell = cellAt(board, startX + dx * i, startY + dy * i);
        if (cell === player) {
          playerCount++;
        } else if (cell === opponent) {
          opponentCount++;
        } else {
          emptyCount++;
        }
      }

      if (playerCount > 0 && opponentCount > 0) continue;
      if (playerCount === 5) {
        totals.wins++;
        continue;
      }
      if (opponentCount > 0) continue;
      if (playerCount === 4 && emptyCount === 1) {
        totals.reaches++;
      } else if (playerCount === 3 && emptyCount === 2) {
        totals.setups++;
      } else if (playerCount === 2 && emptyCount === 3) {
        totals.pressure++;
      }
    }
  }

  return totals;
}

function lineScore(
  board: BoardState,
  coord: Coordinate,
  dx: number,
  dy: number,
  player: PlayerId,
): number {
  let positive = 0;
  let cx = coord.x + dx;
  let cy = coord.y + dy;
  while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
    positive++;
    cx += dx;
    cy += dy;
  }
  const positiveOpen = inBounds(cx, cy) && cellAt(board, cx, cy) === null;

  let negative = 0;
  cx = coord.x - dx;
  cy = coord.y - dy;
  while (inBounds(cx, cy) && cellAt(board, cx, cy) === player) {
    negative++;
    cx -= dx;
    cy -= dy;
  }
  const negativeOpen = inBounds(cx, cy) && cellAt(board, cx, cy) === null;

  const count = positive + negative + 1;
  let openEnds = 0;
  if (positiveOpen) openEnds++;
  if (negativeOpen) openEnds++;

  return patternScore(count, openEnds);
}

export function analyzeMoveTactics(
  board: BoardState,
  coord: Coordinate,
  player: PlayerId,
): MoveTactics {
  if (!inBounds(coord.x, coord.y) || cellAt(board, coord.x, coord.y) !== null) {
    return {
      createsWin: false,
      blocksOpponentWin: false,
      createsReachCount: 0,
      blocksOpponentReachCount: 0,
      createsSetupCount: 0,
      blocksOpponentSetupCount: 0,
    };
  }

  const opponent = getNextPlayer(player);
  const nextBoard = placeStone(board, coord, player);
  const ownPatterns = collectWindowPatternsAt(nextBoard, coord, player);
  const opponentPatterns = collectWindowPatternsAt(board, coord, opponent);

  return {
    createsWin: checkWinAt(nextBoard, coord, player),
    blocksOpponentWin: wouldCreateWinByPlacement(board, coord, opponent),
    createsReachCount: ownPatterns.reaches,
    blocksOpponentReachCount: opponentPatterns.reaches,
    createsSetupCount: ownPatterns.setups,
    blocksOpponentSetupCount: opponentPatterns.setups,
  };
}

export function classifyBoardSituation(
  board: BoardState,
  player: PlayerId,
  candidates: Coordinate[],
): CpuSituation {
  let hasImmediateWin = false;
  let mustBlockWin = false;
  let hasReachAttack = false;
  let hasReachBlock = false;

  for (const coord of candidates) {
    const tactics = analyzeMoveTactics(board, coord, player);
    if (tactics.createsWin) {
      hasImmediateWin = true;
    }
    if (tactics.blocksOpponentWin) {
      mustBlockWin = true;
    }
    if (tactics.createsReachCount > 0) {
      hasReachAttack = true;
    }
    if (tactics.blocksOpponentReachCount > 0) {
      hasReachBlock = true;
    }
  }

  if (hasImmediateWin) return "immediateWin";
  if (mustBlockWin) return "mustBlockWin";
  if (hasReachAttack) return "attackReach";
  if (hasReachBlock) return "blockReach";
  return "neutral";
}

export function evaluateBoard(
  board: BoardState,
  cpuPlayer: PlayerId,
  config: CpuConfig,
): number {
  const opponent = getNextPlayer(cpuPlayer);
  const cpuRunScore = scoreRunsForPlayer(board, cpuPlayer);
  const opponentRunScore = scoreRunsForPlayer(board, opponent);
  const cpuWindows = collectWindowPatterns(board, cpuPlayer);
  const opponentWindows = collectWindowPatterns(board, opponent);
  const stoneDiff =
    countStones(board, cpuPlayer) - countStones(board, opponent);

  const raw =
    cpuRunScore * config.attackWeight -
    opponentRunScore * config.defenseWeight +
    stoneDiff * config.stoneAdvantageWeight +
    (cpuWindows.reaches - opponentWindows.reaches) *
      REACH_SCORE *
      config.threatBlockWeight +
    (cpuWindows.setups - opponentWindows.setups) *
      SETUP_SCORE *
      config.threatBlockWeight +
    (cpuWindows.pressure - opponentWindows.pressure) * PRESSURE_SCORE;

  if (config.evaluationNoise === 0) {
    return raw;
  }

  return raw * (1 + (Math.random() - 0.5) * config.evaluationNoise);
}

export function scoreCellPlacement(
  board: BoardState,
  coord: Coordinate,
  player: PlayerId,
  config: CpuConfig,
): number {
  if (!inBounds(coord.x, coord.y) || cellAt(board, coord.x, coord.y) !== null) {
    return -Infinity;
  }

  let structure = 0;
  for (const [dx, dy] of DIRECTIONS) {
    structure +=
      lineScore(board, coord, dx, dy, player) * config.attackWeight +
      lineScore(board, coord, dx, dy, getNextPlayer(player)) *
        config.defenseWeight;
  }

  const tactics = analyzeMoveTactics(board, coord, player);
  const tactical =
    (tactics.createsWin ? WIN_SCORE * 0.92 : 0) +
    (tactics.blocksOpponentWin
      ? WIN_SCORE * 0.8 * config.threatBlockWeight
      : 0) +
    tactics.createsReachCount * REACH_SCORE * 1.25 +
    tactics.blocksOpponentReachCount *
      REACH_SCORE *
      0.9 *
      config.threatBlockWeight +
    tactics.createsSetupCount * SETUP_SCORE * config.attackWeight +
    tactics.blocksOpponentSetupCount *
      SETUP_SCORE *
      0.8 *
      config.threatBlockWeight;

  return structure + tactical;
}

function wouldCreateWinByPlacement(
  board: BoardState,
  coord: Coordinate,
  player: PlayerId,
): boolean {
  if (!inBounds(coord.x, coord.y) || cellAt(board, coord.x, coord.y) !== null) {
    return false;
  }

  const nextBoard = placeStone(board, coord, player);
  return checkWinAt(nextBoard, coord, player);
}
