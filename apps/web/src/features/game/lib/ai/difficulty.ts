/**
 * Difficulty knobs over a single model: search effort, sampling temperature,
 * and deliberate mistakes. "easy" skips search entirely (one net call).
 */

import { MAX_CANDIDATES } from "@pkg/shared/constants";
import { bestSubset } from "./ev";
import { encodeBoard, legalCells } from "./features";
import type { SearchOptions } from "./search";
import { runSearch } from "./search";
import {
  CELLS,
  type CpuDifficulty,
  type EngineMove,
  type Evaluate,
  type RandomFn,
} from "./types";

export interface DifficultyConfig {
  useSearch: boolean;
  search: SearchOptions;
  /** easy only: softmax temperature over raw policy logits. */
  policyTemperature: number;
  /** easy only: probability of discarding the best sampled cell. */
  policyTopDropout: number;
}

export const DIFFICULTY_CONFIGS: Record<CpuDifficulty, DifficultyConfig> = {
  hard: {
    useSearch: true,
    search: {
      maxChildren: 32,
      mRootCells: 16,
      simulations: 64,
      passSimulations: 4,
      cPuct: 1.5,
      rootNoiseScale: 0.3,
      deadlineMs: 900,
      qNoise: 0,
      topCellDropout: 0,
      forceTactics: true,
    },
    policyTemperature: 1,
    policyTopDropout: 0,
  },
  medium: {
    useSearch: true,
    search: {
      maxChildren: 24,
      mRootCells: 8,
      simulations: 16,
      passSimulations: 2,
      cPuct: 1.5,
      rootNoiseScale: 1.0,
      deadlineMs: 600,
      qNoise: 0.15,
      topCellDropout: 0.05,
      forceTactics: true,
    },
    policyTemperature: 1,
    policyTopDropout: 0,
  },
  easy: {
    useSearch: false,
    search: {
      maxChildren: 16,
      mRootCells: 5,
      simulations: 0,
      passSimulations: 0,
      cPuct: 1.5,
      rootNoiseScale: 1.0,
      deadlineMs: 300,
      qNoise: 0,
      topCellDropout: 0,
      forceTactics: false,
    },
    policyTemperature: 1.6,
    policyTopDropout: 0.25,
  },
};

function gumbel(rng: RandomFn): number {
  return -Math.log(-Math.log(Math.max(rng(), 1e-12)));
}

/** Fixed soft preference over candidate counts for "easy" (index = k - 1). */
const EASY_K_WEIGHTS = [0.15, 0.2, 0.3, 0.2, 0.15];

/** easy: one net call, temperature-sampled cells, soft random k. */
async function policyOnlyMove(
  board: Int8Array,
  toMove: number,
  config: DifficultyConfig,
  evaluate: Evaluate,
  rng: RandomFn,
): Promise<EngineMove> {
  const started = performance.now();
  const { logits, values } = await evaluate([encodeBoard(board, toMove)]);
  const policy = logits[0] as Float32Array;
  const legal = legalCells(board);

  const scored = legal.map((cell) => ({
    cell,
    score: (policy[cell] as number) / config.policyTemperature + gumbel(rng),
    logit: policy[cell] as number,
  }));
  scored.sort((a, b) => b.score - a.score);
  if (
    config.policyTopDropout > 0 &&
    scored.length > 1 &&
    rng() < config.policyTopDropout
  ) {
    scored.shift();
  }

  let k = 1;
  const roll = rng();
  let acc = 0;
  for (let i = 0; i < EASY_K_WEIGHTS.length; i++) {
    acc += EASY_K_WEIGHTS[i] as number;
    if (roll < acc) {
      k = i + 1;
      break;
    }
  }
  k = Math.min(k, scored.length, MAX_CANDIDATES);

  const picked = scored.slice(0, k);
  picked.sort((a, b) => b.logit - a.logit);
  return {
    cells: picked.map((entry) => entry.cell),
    rootValue: values[0] as number,
    evalCount: 1,
    thinkMs: performance.now() - started,
  };
}

export async function computeEngineMove(
  board: Int8Array,
  toMove: number,
  difficulty: CpuDifficulty,
  evaluate: Evaluate,
  rng: RandomFn,
): Promise<EngineMove> {
  const config = DIFFICULTY_CONFIGS[difficulty];
  if (!config.useSearch) {
    return policyOnlyMove(board, toMove, config, evaluate, rng);
  }
  return runSearch(board, toMove, config.search, evaluate, rng);
}

/** Emergency move when the engine fails mid-game: legal cells near stones. */
export function emergencyMove(board: Int8Array, rng: RandomFn): number[] {
  const legal = legalCells(board);
  if (legal.length === 0) return [];
  const occupied = new Set<number>();
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== 0) occupied.add(i);
  }
  const near = legal.filter((cell) => {
    const x = cell % 15;
    const y = Math.floor(cell / 15);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (
          cx >= 0 &&
          cx < 15 &&
          cy >= 0 &&
          cy < 15 &&
          occupied.has(cy * 15 + cx)
        ) {
          return true;
        }
      }
    }
    return false;
  });
  const pool = near.length > 0 ? near : legal;
  const picked = new Set<number>();
  while (picked.size < Math.min(3, pool.length)) {
    picked.add(pool[Math.floor(rng() * pool.length)] as number);
  }
  return [...picked];
}

// re-exported for tests
export { bestSubset };
