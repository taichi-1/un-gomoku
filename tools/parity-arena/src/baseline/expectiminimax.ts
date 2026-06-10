import { placeStone } from "@pkg/core/board";
import { getNextPlayer } from "@pkg/core/game-state";
import { checkWinAt } from "@pkg/core/win-detection";
import { MAX_CANDIDATES, SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import type { CpuConfig, CpuSituation } from "./config";
import {
  analyzeMoveTactics,
  classifyBoardSituation,
  evaluateBoard,
  WIN_SCORE,
} from "./evaluation";
import { generateCandidateCells } from "./move-generator";

export interface CpuMoveResult {
  candidates: Coordinate[];
}

export function computeBestMove(
  board: BoardState,
  cpuPlayer: PlayerId,
  config: CpuConfig,
): CpuMoveResult {
  const rankedCells = generateCandidateCells(board, cpuPlayer, config);

  if (rankedCells.length === 0) {
    return { candidates: [] };
  }

  if (rankedCells.length === 1) {
    return { candidates: rankedCells };
  }

  const situation = classifyBoardSituation(board, cpuPlayer, rankedCells);
  const maxCount = Math.min(MAX_CANDIDATES, rankedCells.length);

  let bestValue = -Infinity;
  let bestCount = 1;

  for (let n = 1; n <= maxCount; n++) {
    const subset = rankedCells.slice(0, n);
    const ev = chanceNode(
      board,
      config.searchDepth,
      cpuPlayer,
      cpuPlayer,
      subset,
      -Infinity,
      Infinity,
      config,
    );
    const adjusted =
      ev +
      candidateCountBias(config, situation, n) +
      candidateSetBonus(board, cpuPlayer, subset, config);

    if (adjusted > bestValue) {
      bestValue = adjusted;
      bestCount = n;
    }
  }

  return { candidates: rankedCells.slice(0, bestCount) };
}

function chanceNode(
  board: BoardState,
  depth: number,
  currentPlayer: PlayerId,
  cpuPlayer: PlayerId,
  candidates: Coordinate[],
  alpha: number,
  beta: number,
  config: CpuConfig,
): number {
  const n = candidates.length;
  const successProb = SUCCESS_PROBABILITY[n] ?? 0.5;
  const failureProb = 1 - successProb;

  let failureValue: number;
  if (depth <= 1) {
    failureValue = evaluateBoard(board, cpuPlayer, config);
  } else {
    const nextPlayer = getNextPlayer(currentPlayer);
    const nextIsMax = nextPlayer === cpuPlayer;
    failureValue = nextIsMax
      ? maxNode(board, depth - 1, nextPlayer, cpuPlayer, alpha, beta, config)
      : minNode(board, depth - 1, nextPlayer, cpuPlayer, alpha, beta, config);
  }

  let successSum = 0;
  for (const candidate of candidates) {
    const nextBoard = placeStone(board, candidate, currentPlayer);

    if (checkWinAt(nextBoard, candidate, currentPlayer)) {
      successSum += currentPlayer === cpuPlayer ? WIN_SCORE : -WIN_SCORE;
      continue;
    }

    if (depth <= 1) {
      successSum += evaluateBoard(nextBoard, cpuPlayer, config);
      continue;
    }

    const nextPlayer = getNextPlayer(currentPlayer);
    const nextIsMax = nextPlayer === cpuPlayer;
    successSum += nextIsMax
      ? maxNode(
          nextBoard,
          depth - 1,
          nextPlayer,
          cpuPlayer,
          alpha,
          beta,
          config,
        )
      : minNode(
          nextBoard,
          depth - 1,
          nextPlayer,
          cpuPlayer,
          alpha,
          beta,
          config,
        );
  }

  const successAvg = successSum / n;
  const expected = successProb * successAvg + failureProb * failureValue;

  if (currentPlayer !== cpuPlayer || config.riskAversion <= 0) {
    return expected;
  }

  const downside = Math.max(0, successAvg - failureValue);
  const riskPenalty = config.riskAversion * failureProb * downside;
  return expected - riskPenalty;
}

function maxNode(
  board: BoardState,
  depth: number,
  currentPlayer: PlayerId,
  cpuPlayer: PlayerId,
  alpha: number,
  beta: number,
  config: CpuConfig,
): number {
  const cells = generateCandidateCells(board, currentPlayer, config);
  if (cells.length === 0) {
    return evaluateBoard(board, cpuPlayer, config);
  }

  const situation = classifyBoardSituation(board, currentPlayer, cells);
  let best = -Infinity;
  const maxCount = Math.min(MAX_CANDIDATES, cells.length);

  for (let n = 1; n <= maxCount; n++) {
    const subset = cells.slice(0, n);
    const ev = chanceNode(
      board,
      depth,
      currentPlayer,
      cpuPlayer,
      subset,
      alpha,
      beta,
      config,
    );
    const adjusted =
      ev +
      candidateCountBias(config, situation, n) +
      candidateSetBonus(board, currentPlayer, subset, config);

    if (adjusted > best) best = adjusted;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }

  return best;
}

function minNode(
  board: BoardState,
  depth: number,
  currentPlayer: PlayerId,
  cpuPlayer: PlayerId,
  alpha: number,
  beta: number,
  config: CpuConfig,
): number {
  const cells = generateCandidateCells(board, currentPlayer, config);
  if (cells.length === 0) {
    return evaluateBoard(board, cpuPlayer, config);
  }

  const situation = classifyBoardSituation(board, currentPlayer, cells);
  let best = Infinity;
  const maxCount = Math.min(MAX_CANDIDATES, cells.length);

  for (let n = 1; n <= maxCount; n++) {
    const subset = cells.slice(0, n);
    const ev = chanceNode(
      board,
      depth,
      currentPlayer,
      cpuPlayer,
      subset,
      alpha,
      beta,
      config,
    );
    const adjusted =
      ev -
      candidateCountBias(config, situation, n) * 0.35 -
      candidateSetBonus(board, currentPlayer, subset, config) * 0.2;

    if (adjusted < best) best = adjusted;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }

  return best;
}

function candidateCountBias(
  config: CpuConfig,
  situation: CpuSituation,
  candidateCount: number,
): number {
  return config.candidateCountBias[situation][candidateCount - 1] ?? 0;
}

function candidateSetBonus(
  board: BoardState,
  player: PlayerId,
  candidates: Coordinate[],
  config: CpuConfig,
): number {
  let bonus = 0;

  for (const candidate of candidates) {
    const tactics = analyzeMoveTactics(board, candidate, player);
    if (tactics.createsWin) bonus += 12_000;
    if (tactics.blocksOpponentWin) bonus += 10_000 * config.threatBlockWeight;
    bonus += tactics.createsReachCount * 3_200;
    bonus +=
      tactics.blocksOpponentReachCount * 2_400 * config.threatBlockWeight;
    bonus += tactics.createsSetupCount * 500;
    bonus += tactics.blocksOpponentSetupCount * 350 * config.threatBlockWeight;
  }

  const hasForcingLine = bonus >= 10_000;
  if (config.persona === "gambler" && hasForcingLine) {
    bonus -= (candidates.length - 1) * 2_200;
  }

  return bonus;
}
