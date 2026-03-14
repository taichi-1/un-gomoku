/**
 * CPU vs CPU self-play script for validating and tuning MCTS parameters.
 *
 * Usage:
 *   bun scripts/cpu-battle.ts --games 500 --mode difficulty
 *   bun scripts/cpu-battle.ts --games 500 --mode archetype
 *   bun scripts/cpu-battle.ts --games 500 --mode cross
 */

import {
  ARCHETYPE_CONFIGS,
  CPU_CONFIGS,
  type CpuArchetype,
  type CpuConfig,
  type CpuDifficulty,
  computeBestMove,
} from "../apps/web/src/features/game/lib/cpu/index";
import { placeStone } from "../packages/core/board";
import { getNextPlayer } from "../packages/core/game-state";
import { checkWinAt } from "../packages/core/win-detection";
import { BOARD_SIZE, SUCCESS_PROBABILITY } from "../packages/shared/constants";
import type { BoardState, PlayerId } from "../packages/shared/schemas/index";

// ── Config helpers ──

function makeConfig(
  difficulty: CpuDifficulty,
  archetype: CpuArchetype,
): CpuConfig {
  return {
    ...CPU_CONFIGS[difficulty],
    ...ARCHETYPE_CONFIGS[archetype],
    archetype,
  };
}

// ── Game simulation ──

type GameResult = "cpu1" | "cpu2" | "draw";

const MAX_TURNS = 300;

function createEmptyBoard(): BoardState {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from<null>({ length: BOARD_SIZE }).fill(null),
  );
}

function isBoardFull(board: BoardState): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = board[y];
    if (!row) continue;
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (row[x] === null) return false;
    }
  }
  return true;
}

function simulateGame(config1: CpuConfig, config2: CpuConfig): GameResult {
  let board: BoardState = createEmptyBoard();
  let currentPlayer: PlayerId = "player1";
  let turns = 0;

  while (turns < MAX_TURNS) {
    const isCpu1Turn = currentPlayer === "player1";
    const config = isCpu1Turn ? config1 : config2;

    const { candidates } = computeBestMove(board, currentPlayer, config);

    if (candidates.length === 0) {
      // No moves available — draw
      return "draw";
    }

    const n = candidates.length;
    const successProb = SUCCESS_PROBABILITY[n] ?? 0.5;
    const success = Math.random() < successProb;

    if (success) {
      // Pick a random candidate from the list
      const chosenIdx = Math.floor(Math.random() * candidates.length);
      const chosen = candidates[chosenIdx] ?? candidates[0];
      if (!chosen) {
        return "draw";
      }

      board = placeStone(board, chosen, currentPlayer);

      if (checkWinAt(board, chosen, currentPlayer)) {
        return isCpu1Turn ? "cpu1" : "cpu2";
      }

      if (isBoardFull(board)) {
        return "draw";
      }
    }
    // If not successful, no stone is placed — turn still advances

    currentPlayer = getNextPlayer(currentPlayer);
    turns++;
  }

  return "draw";
}

// ── Battle runner ──

interface MatchupResult {
  cpu1Wins: number;
  cpu2Wins: number;
  draws: number;
  total: number;
}

function runMatchup(
  config1: CpuConfig,
  config2: CpuConfig,
  games: number,
): MatchupResult {
  let cpu1Wins = 0;
  let cpu2Wins = 0;
  let draws = 0;

  for (let i = 0; i < games; i++) {
    const result = simulateGame(config1, config2);
    if (result === "cpu1") cpu1Wins++;
    else if (result === "cpu2") cpu2Wins++;
    else draws++;
  }

  return { cpu1Wins, cpu2Wins, draws, total: games };
}

function pct(n: number, total: number): string {
  return ((n / total) * 100).toFixed(1);
}

// ── Modes ──

function runDifficultyMode(games: number): void {
  console.log(`\n=== Difficulty Mode: Hard vs Easy (guardian) ===`);
  console.log(`Games: ${games}`);

  const hardConfig = makeConfig("hard", "guardian");
  const easyConfig = makeConfig("easy", "guardian");

  const result = runMatchup(hardConfig, easyConfig, games);

  const hardWinRate = (result.cpu1Wins / result.total) * 100;

  console.log(
    `Hard wins: ${result.cpu1Wins} (${pct(result.cpu1Wins, result.total)}%)`,
  );
  console.log(
    `Easy wins: ${result.cpu2Wins} (${pct(result.cpu2Wins, result.total)}%)`,
  );
  console.log(`Draws: ${result.draws} (${pct(result.draws, result.total)}%)`);

  if (hardWinRate > 70) {
    console.log(`Result: ✅ PASS (Hard win rate > 70%)`);
  } else {
    console.log(
      `Result: ❌ FAIL (Hard win rate ${hardWinRate.toFixed(1)}% ≤ 70%)`,
    );
  }
}

function runArchetypeMode(games: number): void {
  console.log(`\n=== Archetype Mode: Medium difficulty ===`);

  // "Balanced" = medium difficulty with explorationC=1.0
  const balanced: CpuConfig = {
    ...CPU_CONFIGS.medium,
    explorationC: 1.0,
    decisiveThreshold: 0,
    archetype: "guardian",
  };

  const archetypes: CpuArchetype[] = ["attacker", "guardian", "gambler"];
  const labels: Record<CpuArchetype, string> = {
    attacker: "Attacker",
    guardian: "Guardian",
    gambler: "Gambler",
  };

  for (const archetype of archetypes) {
    const config = makeConfig("medium", archetype);
    const result = runMatchup(config, balanced, games);

    console.log(
      `${labels[archetype]} vs Balanced: ${pct(result.cpu1Wins, result.total)}% | ${pct(result.cpu2Wins, result.total)}% | ${pct(result.draws, result.total)}% draws`,
    );

    const winRate = (result.cpu1Wins / result.total) * 100;
    if (winRate <= 50) {
      console.log(
        `  ⚠️  ${labels[archetype]} win rate ${winRate.toFixed(1)}% ≤ 50% (archetype not distinct enough)`,
      );
    }
  }
}

function runCrossMode(games: number): void {
  console.log(
    `\n=== Cross Mode: All archetypes vs all (medium difficulty) ===`,
  );

  const matchups: [CpuArchetype, CpuArchetype][] = [
    ["attacker", "guardian"],
    ["attacker", "gambler"],
    ["guardian", "gambler"],
  ];

  const labels: Record<CpuArchetype, string> = {
    attacker: "Attacker",
    guardian: "Guardian",
    gambler: "Gambler",
  };

  for (const [a, b] of matchups) {
    const configA = makeConfig("medium", a);
    const configB = makeConfig("medium", b);
    const result = runMatchup(configA, configB, games);

    const aWinRate = (result.cpu1Wins / result.total) * 100;
    const bWinRate = (result.cpu2Wins / result.total) * 100;

    console.log(
      `${labels[a]} vs ${labels[b]}: ${pct(result.cpu1Wins, result.total)}% | ${pct(result.cpu2Wins, result.total)}% | ${pct(result.draws, result.total)}% draws`,
    );

    if (aWinRate > 65) {
      console.log(
        `  ⚠️  ${labels[a]} dominates ${labels[b]} (${aWinRate.toFixed(1)}% > 65%)`,
      );
    } else if (bWinRate > 65) {
      console.log(
        `  ⚠️  ${labels[b]} dominates ${labels[a]} (${bWinRate.toFixed(1)}% > 65%)`,
      );
    }
  }
}

// ── CLI arg parsing ──

function parseArgs(): { games: number; mode: string } {
  const args = process.argv.slice(2);
  let games = 100;
  let mode = "difficulty";

  for (let i = 0; i < args.length; i++) {
    const nextArg = args[i + 1];
    if (args[i] === "--games" && nextArg) {
      const parsed = parseInt(nextArg, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        games = parsed;
        i++;
      }
    } else if (args[i] === "--mode" && nextArg) {
      mode = nextArg;
      i++;
    }
  }

  return { games, mode };
}

// ── Main ──

const { games, mode } = parseArgs();

console.log(`Running CPU battle: mode=${mode}, games=${games}`);

switch (mode) {
  case "difficulty":
    runDifficultyMode(games);
    break;
  case "archetype":
    runArchetypeMode(games);
    break;
  case "cross":
    runCrossMode(games);
    break;
  default:
    console.error(`Unknown mode: ${mode}. Use difficulty | archetype | cross`);
    process.exit(1);
}
