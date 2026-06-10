/**
 * Generates cross-language rule-parity test vectors for the Python training
 * code in ml/.
 *
 * Every random value consumed by resolveTurn is recorded so that the Python
 * port can replay identical games and compare every outcome exactly,
 * including the strict `random() < probability` success check and the
 * `floor(random() * n)` candidate-index selection.
 *
 * Usage: bun run gen:parity   (writes ml/tests/fixtures/rule-vectors.json)
 */

import { join } from "node:path";
import { createEmptyBoard, placeStone, removeStone } from "@pkg/core/board";
import { createInitialGameState } from "@pkg/core/game-state";
import { resolveTurn } from "@pkg/core/turn";
import { validateCandidates } from "@pkg/core/validation";
import { checkWinAt, findWinner } from "@pkg/core/win-detection";
import {
  BOARD_SIZE,
  MAX_CANDIDATES,
  SUCCESS_PROBABILITY,
  WIN_LENGTH,
} from "@pkg/shared/constants";
import type {
  BoardState,
  Coordinate,
  GameStateDTO,
  PlayerId,
} from "@pkg/shared/schemas";

const RANDOM_GAME_COUNT = 60;
const RANDOM_GAME_SEED_BASE = 1000;
const MAX_TURNS_PER_GAME = 800;

type XY = [number, number];

interface TurnVector {
  player: PlayerId;
  candidates: XY[];
  /** Random values consumed by resolveTurn, in draw order. */
  randoms: number[];
  expected: {
    success: boolean;
    placed: XY | null;
    gameOver: boolean;
    winner: PlayerId | null;
    isDraw: boolean;
  };
}

interface GameVector {
  name: string;
  /** Row-major board string ('.'=empty, '1'=player1, '2'=player2); empty board when omitted. */
  initialBoard?: string;
  turns: TurnVector[];
  finalBoard: string;
  finalPhase: "playing" | "finished";
  finalWinner: PlayerId | null;
  finalIsDraw: boolean;
}

interface ValidationVector {
  name: string;
  board: string;
  candidates: XY[];
  expected: { ok: boolean; error: string | null };
}

// ── Deterministic PRNG (mulberry32) ──

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Helpers ──

function boardToString(board: BoardState): string {
  return board
    .map((row) =>
      row
        .map((cell) =>
          cell === "player1" ? "1" : cell === "player2" ? "2" : ".",
        )
        .join(""),
    )
    .join("");
}

function listEmptyCells(board: BoardState): Coordinate[] {
  const cells: Coordinate[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y]?.[x] === null) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function sampleDistinct<T>(items: T[], count: number, rng: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(rng() * pool.length);
    const [picked] = pool.splice(index, 1);
    if (picked === undefined) throw new Error("sampleDistinct: pool exhausted");
    out.push(picked);
  }
  return out;
}

function stateFrom(board: BoardState, currentPlayer: PlayerId): GameStateDTO {
  return {
    ...createInitialGameState(),
    board,
    currentPlayer,
    phase: "playing",
  };
}

function toXY(coord: Coordinate): XY {
  return [coord.x, coord.y];
}

function placeAll(
  board: BoardState,
  coords: XY[],
  player: PlayerId,
): BoardState {
  let next = board;
  for (const [x, y] of coords) {
    next = placeStone(next, { x, y }, player);
  }
  return next;
}

// ── Random playouts ──

function playRandomGame(seed: number): GameVector {
  const rng = mulberry32(seed);
  let state = stateFrom(createEmptyBoard(), "player1");
  const turns: TurnVector[] = [];

  while (state.phase === "playing" && turns.length < MAX_TURNS_PER_GAME) {
    const empties = listEmptyCells(state.board);
    const count = Math.min(
      1 + Math.floor(rng() * MAX_CANDIDATES),
      empties.length,
    );
    const candidates = sampleDistinct(empties, count, rng);
    const validation = validateCandidates(state.board, candidates);
    if (!validation.ok) {
      throw new Error(`generator bug: invalid candidates (seed=${seed})`);
    }

    const randoms: number[] = [];
    const recorder = () => {
      const value = rng();
      randoms.push(value);
      return value;
    };

    const player = state.currentPlayer;
    const { nextState, result } = resolveTurn(
      state,
      player,
      candidates,
      recorder,
    );

    turns.push({
      player,
      candidates: candidates.map(toXY),
      randoms,
      expected: {
        success: result.success,
        placed: result.placedPosition ? toXY(result.placedPosition) : null,
        gameOver: result.gameOver,
        winner: result.winner,
        isDraw: nextState.isDraw,
      },
    });
    state = nextState;
  }

  return {
    name: `random-playout-${seed}`,
    turns,
    finalBoard: boardToString(state.board),
    finalPhase: state.phase === "finished" ? "finished" : "playing",
    finalWinner: state.winner,
    finalIsDraw: state.isDraw,
  };
}

// ── Directed cases ──

/** Runs a single resolveTurn with a fixed random stream and packages it as a GameVector. */
function directedCase(
  name: string,
  board: BoardState,
  player: PlayerId,
  candidates: XY[],
  randoms: number[],
): GameVector {
  const coords = candidates.map(([x, y]) => ({ x, y }));
  const validation = validateCandidates(board, coords);
  if (!validation.ok) {
    throw new Error(`directed case ${name}: invalid candidates`);
  }

  let cursor = 0;
  const rng = () => {
    const value = randoms[cursor];
    if (value === undefined) {
      throw new Error(`directed case ${name}: random stream exhausted`);
    }
    cursor++;
    return value;
  };

  const { nextState, result } = resolveTurn(
    stateFrom(board, player),
    player,
    coords,
    rng,
  );
  if (cursor !== randoms.length) {
    throw new Error(
      `directed case ${name}: provided ${randoms.length} randoms, consumed ${cursor}`,
    );
  }

  return {
    name,
    initialBoard: boardToString(board),
    turns: [
      {
        player,
        candidates,
        randoms,
        expected: {
          success: result.success,
          placed: result.placedPosition ? toXY(result.placedPosition) : null,
          gameOver: result.gameOver,
          winner: result.winner,
          isDraw: nextState.isDraw,
        },
      },
    ],
    finalBoard: boardToString(nextState.board),
    finalPhase: nextState.phase === "finished" ? "finished" : "playing",
    finalWinner: nextState.winner,
    finalIsDraw: nextState.isDraw,
  };
}

/** Far-corner player2 stones so win-case boards contain both colors without interfering. */
const NEUTRAL_P2_STONES: XY[] = [
  [13, 0],
  [14, 0],
  [13, 1],
  [14, 1],
];

function buildWinCases(): GameVector[] {
  const cases: GameVector[] = [];
  const base = () => placeAll(createEmptyBoard(), NEUTRAL_P2_STONES, "player2");

  const expectWin = (vector: GameVector, name: string) => {
    const turn = vector.turns[0];
    if (!turn?.expected.gameOver || turn.expected.winner === null) {
      throw new Error(`win case ${name}: expected a win`);
    }
    return vector;
  };

  // Horizontal, completing cell at the right end.
  cases.push(
    expectWin(
      directedCase(
        "win-horizontal-center",
        placeAll(
          base(),
          [
            [3, 7],
            [4, 7],
            [5, 7],
            [6, 7],
          ],
          "player1",
        ),
        "player1",
        [[7, 7]],
        [0.0, 0.0],
      ),
      "win-horizontal-center",
    ),
  );

  // Vertical along the left edge.
  cases.push(
    expectWin(
      directedCase(
        "win-vertical-left-edge",
        placeAll(
          base(),
          [
            [0, 0],
            [0, 1],
            [0, 2],
            [0, 3],
          ],
          "player1",
        ),
        "player1",
        [[0, 4]],
        [0.0, 0.0],
      ),
      "win-vertical-left-edge",
    ),
  );

  // Diagonal down-right finishing exactly in the corner.
  cases.push(
    expectWin(
      directedCase(
        "win-diagonal-dr-corner",
        placeAll(
          base(),
          [
            [10, 10],
            [11, 11],
            [12, 12],
            [13, 13],
          ],
          "player1",
        ),
        "player1",
        [[14, 14]],
        [0.0, 0.0],
      ),
      "win-diagonal-dr-corner",
    ),
  );

  // Diagonal up-right.
  cases.push(
    expectWin(
      directedCase(
        "win-diagonal-ur",
        placeAll(
          base(),
          [
            [2, 12],
            [3, 11],
            [4, 10],
            [5, 9],
          ],
          "player1",
        ),
        "player1",
        [[6, 8]],
        [0.0, 0.0],
      ),
      "win-diagonal-ur",
    ),
  );

  // Placed stone bridges two runs (counted in both directions).
  cases.push(
    expectWin(
      directedCase(
        "win-bridge-middle",
        placeAll(
          base(),
          [
            [4, 4],
            [5, 4],
            [7, 4],
            [8, 4],
          ],
          "player1",
        ),
        "player1",
        [[6, 4]],
        [0.0, 0.0],
      ),
      "win-bridge-middle",
    ),
  );

  // Overline: completing six in a row still wins (count >= WIN_LENGTH).
  cases.push(
    expectWin(
      directedCase(
        "win-overline-six",
        placeAll(
          base(),
          [
            [0, 0],
            [1, 0],
            [3, 0],
            [4, 0],
            [5, 0],
          ],
          "player1",
        ),
        "player1",
        [[2, 0]],
        [0.0, 0.0],
      ),
      "win-overline-six",
    ),
  );

  // Player2 wins too (winner field parity).
  cases.push(
    expectWin(
      directedCase(
        "win-player2-horizontal",
        placeAll(
          placeAll(
            createEmptyBoard(),
            [
              [0, 14],
              [1, 14],
              [2, 14],
              [3, 14],
            ],
            "player2",
          ),
          [
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
          ],
          "player1",
        ),
        "player2",
        [[4, 14]],
        [0.0, 0.0],
      ),
      "win-player2-horizontal",
    ),
  );

  // Four in a row is NOT a win.
  const fourCase = directedCase(
    "no-win-four-in-row",
    placeAll(
      base(),
      [
        [3, 7],
        [4, 7],
        [5, 7],
      ],
      "player1",
    ),
    "player1",
    [[6, 7]],
    [0.0, 0.0],
  );
  if (fourCase.turns[0]?.expected.gameOver) {
    throw new Error("no-win-four-in-row: unexpectedly ended the game");
  }
  cases.push(fourCase);

  return cases;
}

function buildProbabilityBoundaryCases(): GameVector[] {
  const cases: GameVector[] = [];
  const board = placeAll(createEmptyBoard(), [[7, 7]], "player2");
  const candidatePool: XY[] = [
    [6, 6],
    [8, 8],
    [6, 8],
    [8, 6],
    [5, 7],
  ];

  for (let count = 1; count <= MAX_CANDIDATES; count++) {
    const probability = SUCCESS_PROBABILITY[count];
    if (probability === undefined) {
      throw new Error(`missing SUCCESS_PROBABILITY for count=${count}`);
    }
    const candidates = candidatePool.slice(0, count);

    // random === probability must FAIL (strict less-than).
    const failCase = directedCase(
      `fail-at-exact-probability-k${count}`,
      board,
      "player1",
      candidates,
      [probability],
    );
    if (failCase.turns[0]?.expected.success) {
      throw new Error(`fail-at-exact-probability-k${count}: expected failure`);
    }
    cases.push(failCase);

    // random just below probability must SUCCEED.
    const successCase = directedCase(
      `success-just-below-probability-k${count}`,
      board,
      "player1",
      candidates,
      [probability - 1e-12, 0.5],
    );
    if (!successCase.turns[0]?.expected.success) {
      throw new Error(
        `success-just-below-probability-k${count}: expected success`,
      );
    }
    cases.push(successCase);
  }

  // Candidate index selection edges: floor(random * n).
  const five = candidatePool.slice(0, 5);
  cases.push(
    directedCase("index-first-of-five", board, "player1", five, [0.0, 0.0]),
  );
  cases.push(
    directedCase(
      "index-last-of-five",
      board,
      "player1",
      five,
      [0.0, 0.999999999999],
    ),
  );
  cases.push(
    directedCase("index-middle-of-five", board, "player1", five, [0.0, 0.5]),
  );

  return cases;
}

/**
 * Fills the whole board with no five-in-a-row anywhere, choosing greedily per
 * cell (random color first, flip if it would create a win). Returns null when
 * the greedy fill dead-ends; callers retry with another seed.
 */
function buildNoWinFullBoard(seed: number): BoardState | null {
  const rng = mulberry32(seed);
  let board = createEmptyBoard();
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const first: PlayerId = rng() < 0.5 ? "player1" : "player2";
      const second: PlayerId = first === "player1" ? "player2" : "player1";
      let placed = false;
      for (const player of [first, second]) {
        const next = placeStone(board, { x, y }, player);
        if (!checkWinAt(next, { x, y }, player)) {
          board = next;
          placed = true;
          break;
        }
      }
      if (!placed) return null;
    }
  }
  if (findWinner(board) !== null) return null;
  return board;
}

function buildEndgameCases(): GameVector[] {
  const cases: GameVector[] = [];

  // Draw: last empty cell filled without creating a win.
  let drawBuilt = false;
  for (let seed = 1; seed <= 200 && !drawBuilt; seed++) {
    const full = buildNoWinFullBoard(seed);
    if (!full) continue;
    const lastColor = full[14]?.[14];
    if (lastColor !== "player1" && lastColor !== "player2") continue;
    const board = removeStone(full, { x: 14, y: 14 });
    const vector = directedCase(
      "draw-on-last-cell",
      board,
      lastColor,
      [[14, 14]],
      [0.0, 0.0],
    );
    const expected = vector.turns[0]?.expected;
    if (!expected?.gameOver || !expected.isDraw || expected.winner !== null) {
      throw new Error("draw-on-last-cell: expected a draw");
    }
    cases.push(vector);
    drawBuilt = true;
  }
  if (!drawBuilt) throw new Error("could not construct draw-on-last-cell");

  // Win precedence: completing five on the final cell wins (not a draw).
  let winFullBuilt = false;
  for (let seed = 1; seed <= 200 && !winFullBuilt; seed++) {
    const full = buildNoWinFullBoard(seed);
    if (!full) continue;
    let board = full;
    for (const [x, y] of [
      [10, 14],
      [11, 14],
      [12, 14],
      [13, 14],
      [14, 14],
    ] as XY[]) {
      board = removeStone(board, { x, y });
    }
    board = placeAll(
      board,
      [
        [10, 14],
        [11, 14],
        [12, 14],
        [13, 14],
      ],
      "player1",
    );
    if (findWinner(board) !== null) continue;
    const vector = directedCase(
      "win-on-full-board",
      board,
      "player1",
      [[14, 14]],
      [0.0, 0.0],
    );
    const expected = vector.turns[0]?.expected;
    if (
      !expected?.gameOver ||
      expected.winner !== "player1" ||
      expected.isDraw
    ) {
      throw new Error("win-on-full-board: expected a player1 win");
    }
    cases.push(vector);
    winFullBuilt = true;
  }
  if (!winFullBuilt) throw new Error("could not construct win-on-full-board");

  return cases;
}

function buildValidationCases(): ValidationVector[] {
  const board = placeAll(createEmptyBoard(), [[7, 7]], "player1");
  const boardString = boardToString(board);
  const empty: XY[][] = [
    [[0, 0]],
    [
      [0, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ],
  ];

  const cases: ValidationVector[] = empty.map((candidates) => ({
    name: `valid-count-${candidates.length}`,
    board: boardString,
    candidates,
    expected: { ok: true, error: null },
  }));

  cases.push(
    {
      name: "invalid-count-zero",
      board: boardString,
      candidates: [],
      expected: { ok: false, error: "invalid_candidate_count" },
    },
    {
      name: "invalid-count-six",
      board: boardString,
      candidates: [
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
        [5, 5],
      ],
      expected: { ok: false, error: "invalid_candidate_count" },
    },
    {
      name: "invalid-occupied-cell",
      board: boardString,
      candidates: [[7, 7]],
      expected: { ok: false, error: "invalid_candidate_position" },
    },
    {
      name: "invalid-out-of-bounds-x",
      board: boardString,
      candidates: [[15, 0]],
      expected: { ok: false, error: "invalid_candidate_position" },
    },
    {
      name: "invalid-negative-y",
      board: boardString,
      candidates: [[3, -1]],
      expected: { ok: false, error: "invalid_candidate_position" },
    },
  );

  // Verify every expectation against the real implementation.
  for (const testCase of cases) {
    const coords = testCase.candidates.map(([x, y]) => ({ x, y }));
    const result = validateCandidates(board, coords);
    const matches = result.ok
      ? testCase.expected.ok
      : !testCase.expected.ok && result.error === testCase.expected.error;
    if (!matches) {
      throw new Error(`validation case ${testCase.name}: expectation mismatch`);
    }
  }

  return cases;
}

// ── Main ──

async function main(): Promise<void> {
  const games: GameVector[] = [];
  for (let i = 0; i < RANDOM_GAME_COUNT; i++) {
    games.push(playRandomGame(RANDOM_GAME_SEED_BASE + i));
  }
  games.push(...buildWinCases());
  games.push(...buildProbabilityBoundaryCases());
  games.push(...buildEndgameCases());

  const data = {
    meta: {
      generator: "tools/parity-arena/src/generate-vectors.ts",
      boardSize: BOARD_SIZE,
      winLength: WIN_LENGTH,
      maxCandidates: MAX_CANDIDATES,
      successProbability: SUCCESS_PROBABILITY,
      randomGameCount: RANDOM_GAME_COUNT,
      randomGameSeedBase: RANDOM_GAME_SEED_BASE,
    },
    games,
    validationCases: buildValidationCases(),
  };

  const outPath = join(
    import.meta.dir,
    "..",
    "..",
    "..",
    "ml",
    "tests",
    "fixtures",
    "rule-vectors.json",
  );
  await Bun.write(outPath, JSON.stringify(data));

  const turnCount = games.reduce((sum, game) => sum + game.turns.length, 0);
  const finished = games.filter((game) => game.finalPhase === "finished");
  console.log(
    `wrote ${outPath}: ${games.length} games (${finished.length} finished), ` +
      `${turnCount} turns, ${data.validationCases.length} validation cases`,
  );
}

await main();
