/**
 * Chance-aware Gumbel-style search — TS port of ml/src/ungomoku_ml/mcts/.
 *
 * Tree: a decision node is (board, toMove); children are one node per
 * candidate cell plus a "pass" child (the failed-turn outcome). Values are
 * from the node's mover perspective and back up through the exact
 * EV-over-subsets operator (ev.ts), so the chance structure is preserved.
 *
 * Browser adaptation vs the Python trainer: simulations for different root
 * arms are independent, so each sequential-halving step descends every
 * surviving arm once and evaluates the collected leaves as ONE batched net
 * call (efficient under WASM). A wall-clock deadline can stop halving early —
 * Gumbel degrades gracefully since current Q estimates are always usable.
 */

import { MAX_CANDIDATES, SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import { bestSubset, evCurve } from "./ev";
import {
  checkWinAtFlat,
  forcingWinCellsFlat,
  isBoardFullFlat,
  winningCellsFlat,
} from "./tactics";
import {
  CELLS,
  EMPTY,
  type EngineMove,
  type Evaluate,
  otherStone,
  type RandomFn,
} from "./types";

export interface SearchOptions {
  maxChildren: number;
  mRootCells: number;
  simulations: number;
  passSimulations: number;
  cPuct: number;
  /** Gumbel noise on root cell sampling (exploration / variety). */
  rootNoiseScale: number;
  /** Wall-clock budget; halving stops early when exceeded. */
  deadlineMs: number;
  /** Gumbel noise added to refined arm Qs before subset construction. */
  qNoise: number;
  /** Probability of dropping the best arm before subset construction. */
  topCellDropout: number;
  /** Always include immediate win/block cells as children and root arms. */
  forceTactics: boolean;
  /** Root forced-sequence solver depth (0 disables). */
  solverDepth: number;
}

const PASS = -1;
const DEFAULT_KSTAR = 3;

function successProbability(k: number): number {
  return SUCCESS_PROBABILITY[k] ?? 0.5;
}

class Node {
  board: Int8Array; // never mutated after construction
  toMove: number;
  terminalValue: number | null;
  expanded = false;
  vNet = 0;
  value: number;
  kstar = DEFAULT_KSTAR;
  nTotal = 0;
  cells: number[] = [];
  priors: number[] = [];
  childN: number[] = [];
  children: (Node | null)[] = [];
  /** Indices into cells of forced win/block children (visited first). */
  forced: number[] = [];
  passChild: Node | null = null;

  constructor(
    board: Int8Array,
    toMove: number,
    terminalValue: number | null = null,
  ) {
    this.board = board;
    this.toMove = toMove;
    this.terminalValue = terminalValue;
    this.value = terminalValue ?? 0;
  }

  get isTerminal(): boolean {
    return this.terminalValue !== null;
  }
}

function expand(
  node: Node,
  logits: Float32Array,
  value: number,
  maxChildren: number,
  forceTactics: boolean,
  rootSolverDepth = 0,
): void {
  const legal: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (node.board[i] === EMPTY) legal.push(i);
  }
  legal.sort((a, b) => (logits[b] as number) - (logits[a] as number) || a - b);
  let cells = legal.slice(0, maxChildren);

  if (forceTactics) {
    const forcedIds = new Set<number>([
      ...winningCellsFlat(node.board, node.toMove),
      ...winningCellsFlat(node.board, otherStone(node.toMove)),
    ]);
    if (rootSolverDepth >= 1) {
      // Forced-sequence initiators for both sides (root-only board scan).
      for (const cell of forcingWinCellsFlat(
        node.board,
        node.toMove,
        rootSolverDepth,
      )) {
        forcedIds.add(cell);
      }
      for (const cell of forcingWinCellsFlat(
        node.board,
        otherStone(node.toMove),
        rootSolverDepth,
      )) {
        forcedIds.add(cell);
      }
    }
    const missing = [...forcedIds].filter((cell) => !cells.includes(cell));
    if (missing.length > 0) {
      const keep = Math.max(0, maxChildren - missing.length);
      cells =
        cells.length + missing.length > maxChildren
          ? [...cells.slice(0, keep), ...missing]
          : [...cells, ...missing];
    }
    node.forced = [];
    cells.forEach((cell, index) => {
      if (forcedIds.has(cell)) node.forced.push(index);
    });
  }
  let maxLogit = -Infinity;
  for (const cell of cells) {
    maxLogit = Math.max(maxLogit, logits[cell] as number);
  }
  let total = 0;
  const priors = cells.map((cell) => {
    const p = Math.exp((logits[cell] as number) - maxLogit);
    total += p;
    return p;
  });
  node.cells = cells;
  node.priors = priors.map((p) => p / total);
  node.children = cells.map(() => null);
  node.childN = cells.map(() => 0);
  node.vNet = value;
  node.value = value;
  node.kstar = Math.min(DEFAULT_KSTAR, cells.length);
  node.expanded = true;
}

function ensureCellChild(node: Node, index: number): Node {
  const existing = node.children[index];
  if (existing) return existing;
  const cell = node.cells[index] as number;
  const board = node.board.slice();
  board[cell] = node.toMove;
  const opponent = otherStone(node.toMove);
  let child: Node;
  if (checkWinAtFlat(board, cell, node.toMove)) {
    child = new Node(board, opponent, -1);
  } else if (isBoardFullFlat(board)) {
    child = new Node(board, opponent, 0);
  } else {
    child = new Node(board, opponent);
  }
  node.children[index] = child;
  return child;
}

function ensurePassChild(node: Node): Node {
  if (!node.passChild) {
    // Board shared: a failed turn changes nothing and boards are immutable.
    node.passChild = new Node(node.board, otherStone(node.toMove));
  }
  return node.passChild;
}

function childQ(node: Node, index: number): number | null {
  const child = node.children[index];
  if (!child || (!child.expanded && !child.isTerminal)) return null;
  return -child.value;
}

function passQ(node: Node): number {
  const child = node.passChild;
  if (child && (child.expanded || child.isTerminal)) return -child.value;
  return node.vNet;
}

function recompute(node: Node): void {
  const qs: number[] = [];
  for (let i = 0; i < node.cells.length; i++) {
    const q = childQ(node, i);
    if (q !== null) qs.push(q);
  }
  if (qs.length === 0) {
    node.value = node.vNet;
    node.kstar = Math.min(DEFAULT_KSTAR, node.cells.length);
    return;
  }
  qs.sort((a, b) => b - a);
  const curve = evCurve(qs, passQ(node), MAX_CANDIDATES);
  let best = 0;
  for (let k = 1; k < curve.length; k++) {
    if ((curve[k] as number) > (curve[best] as number)) best = k;
  }
  node.value = curve[best] as number;
  node.kstar = best + 1;
}

function selectCell(node: Node, cPuct: number): number {
  // Unvisited forced (win/block) cells first: their exact values anchor EV.
  for (const index of node.forced) {
    if (node.childN[index] === 0) return index;
  }
  const sqrtTotal = Math.sqrt(node.nTotal + 1);
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < node.cells.length; i++) {
    const q = childQ(node, i) ?? node.value;
    const u =
      cPuct *
      (node.priors[i] as number) *
      (sqrtTotal / (1 + (node.childN[i] as number)));
    const score = q + u;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

interface PathStep {
  node: Node;
  action: number; // PASS or cell-child index
}

interface PendingSim {
  path: PathStep[];
  leaf: Node;
}

/** Descends one simulation entering the root via firstAction; no backup yet. */
function descend(
  root: Node,
  firstAction: number,
  cPuct: number,
  rng: RandomFn,
): PendingSim {
  const path: PathStep[] = [{ node: root, action: firstAction }];
  let cur =
    firstAction === PASS
      ? ensurePassChild(root)
      : ensureCellChild(root, firstAction);
  while (cur.expanded && !cur.isTerminal) {
    if (rng() >= successProbability(cur.kstar)) {
      path.push({ node: cur, action: PASS });
      cur = ensurePassChild(cur);
    } else {
      const index = selectCell(cur, cPuct);
      path.push({ node: cur, action: index });
      cur = ensureCellChild(cur, index);
    }
  }
  return { path, leaf: cur };
}

function backup(path: PathStep[]): void {
  for (let i = path.length - 1; i >= 0; i--) {
    const step = path[i] as PathStep;
    if (step.action === PASS) {
      // pass visits are not tracked per arm; nTotal still advances below
    } else {
      step.node.childN[step.action] =
        (step.node.childN[step.action] as number) + 1;
    }
    step.node.nTotal += 1;
    recompute(step.node);
  }
}

function gumbel(rng: RandomFn): number {
  // Inverse CDF; clamp away from 0 to avoid -Infinity.
  return -Math.log(-Math.log(Math.max(rng(), 1e-12)));
}

/** Runs the pending sims' evals as one batch, then backs them all up. */
async function settle(
  pending: PendingSim[],
  evaluate: Evaluate,
  options: SearchOptions,
  counter: { evals: number },
): Promise<void> {
  const needEval = pending.filter(
    (sim) => !sim.leaf.isTerminal && !sim.leaf.expanded,
  );
  if (needEval.length > 0) {
    const { logits, values } = await evaluate(
      needEval.map((sim) => ({
        board: sim.leaf.board,
        toMove: sim.leaf.toMove,
      })),
    );
    counter.evals += needEval.length;
    needEval.forEach((sim, row) => {
      // Two sims can share a leaf (e.g. pass chains); expand only once.
      if (!sim.leaf.expanded) {
        expand(
          sim.leaf,
          logits[row] as Float32Array,
          values[row] as number,
          options.maxChildren,
          options.forceTactics,
        );
      }
    });
  }
  for (const sim of pending) {
    backup(sim.path);
  }
}

export async function runSearch(
  board: Int8Array,
  toMove: number,
  options: SearchOptions,
  evaluate: Evaluate,
  rng: RandomFn,
): Promise<EngineMove> {
  const started = performance.now();
  const deadline = started + options.deadlineMs;
  const counter = { evals: 0 };

  const root = new Node(board.slice(), toMove);
  {
    const { logits, values } = await evaluate([
      { board: root.board, toMove: root.toMove },
    ]);
    counter.evals += 1;
    expand(
      root,
      logits[0] as Float32Array,
      values[0] as number,
      options.maxChildren,
      options.forceTactics,
      options.forceTactics ? options.solverDepth : 0,
    );
  }

  // Root arm sampling over the root's candidate cells.
  const rootLogits = root.cells.map((_cell, i) => ({
    index: i,
    score:
      // biome-ignore lint/style/noNonNullAssertion: cells/priors are aligned
      Math.log(root.priors[i]!) +
      (options.rootNoiseScale > 0 ? options.rootNoiseScale * gumbel(rng) : 0),
  }));
  rootLogits.sort((a, b) => b.score - a.score || a.index - b.index);
  const m = Math.min(options.mRootCells, root.cells.length);
  let active = rootLogits.slice(0, m).map((entry) => entry.index);
  // Forced win/block cells are always arms (EV-subset eligible).
  for (const index of root.forced) {
    if (!active.includes(index)) active.push(index);
  }
  const arms = [...active];

  // Pass simulations refine Q_pass (sequential: each depends on the last).
  for (let i = 0; i < options.passSimulations; i++) {
    await settle(
      [descend(root, PASS, options.cPuct, rng)],
      evaluate,
      options,
      counter,
    );
    if (performance.now() > deadline) break;
  }

  // Sequential halving; each step batches one descent per surviving arm.
  const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, arms.length))));
  let budgetLeft = options.simulations;
  for (let round = 0; round < rounds && budgetLeft > 0; round++) {
    // Round 0 needs two sims per arm: the first only expands the child
    // (pure prior), the second is the minimum for real refinement (e.g.
    // finding the opponent's immediate win below a non-blocking move).
    const simsPerArm = Math.max(
      round === 0 ? 2 : 1,
      Math.floor(options.simulations / (rounds * active.length)),
    );
    for (let s = 0; s < simsPerArm && budgetLeft > 0; s++) {
      const pending = active.map((arm) =>
        descend(root, arm, options.cPuct, rng),
      );
      budgetLeft -= pending.length;
      await settle(pending, evaluate, options, counter);
      if (performance.now() > deadline) {
        budgetLeft = 0;
        break;
      }
    }
    if (round < rounds - 1 && active.length > 1) {
      const ranked = [...active].sort(
        (a, b) => (childQ(root, b) ?? -1) - (childQ(root, a) ?? -1),
      );
      active = ranked.slice(0, Math.max(1, Math.floor(active.length / 2)));
    }
  }

  // Move construction: EV rule over refined arm Qs (with difficulty noise).
  let usable = arms.filter((arm) => childQ(root, arm) !== null);
  if (usable.length === 0) {
    usable = [0]; // fall back to the prior-best cell
    ensureCellChild(root, 0);
  }
  if (
    options.topCellDropout > 0 &&
    usable.length > 1 &&
    rng() < options.topCellDropout
  ) {
    const top = usable.reduce((best, arm) =>
      (childQ(root, arm) ?? -1) > (childQ(root, best) ?? -1) ? arm : best,
    );
    usable = usable.filter((arm) => arm !== top);
  }
  const qs = usable.map((arm) => {
    const q = childQ(root, arm) ?? root.vNet;
    return options.qNoise > 0 ? q + options.qNoise * gumbel(rng) : q;
  });
  const { order } = bestSubset(qs, passQ(root));
  const cells = order.map((i) => root.cells[usable[i] as number] as number);

  return {
    cells,
    rootValue: root.value,
    evalCount: counter.evals,
    thinkMs: performance.now() - started,
  };
}
