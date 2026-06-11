"""Gumbel-style root search adapted to subset moves and chance nodes.

Per move:
1. Expand the root with one net eval.
2. Sample m root cells via Gumbel-top-m over policy logits (noise off => plain
   top-m, used for arena/inference).
3. Refine Q_pass with a few simulations into the pass child, then run
   sequential halving over the m cell arms; each simulation descends that
   arm's subtree with PUCT + sampled chance (turn failure) and backs values up
   through the exact EV operator (mcts/node.py).
4. Build the move with the EV-over-subsets rule on the refined Q values, and a
   completed-Q policy target over all 225 cells for training.

The search is written as a generator so a driver can batch evaluations across
many concurrent games: it yields Nodes that need a net eval and receives
(logits, value) back via send().
"""

import math
from collections.abc import Generator
from dataclasses import dataclass

import numpy as np

from ungomoku_ml.config import SearchConfig
from ungomoku_ml.encoding import legal_mask
from ungomoku_ml.mcts.ev import best_subset
from ungomoku_ml.mcts.node import (
    PASS,
    Node,
    child_q,
    ensure_cell_child,
    ensure_pass_child,
    expand,
    pass_q,
    recompute,
    select_cell,
)
from ungomoku_ml.rules import SUCCESS_PROBABILITY

EvalResult = tuple[np.ndarray, float]  # (logits (225,), value)
SearchGen = Generator[Node, EvalResult, "MoveResult"]


@dataclass
class MoveResult:
    """One resolved move decision."""

    cells: list[int]  # flat indices, best-first (1..5 entries)
    policy_target: np.ndarray | None  # (225,) float32; None for scripted agents
    root_value: float


def _backup(path: list[tuple[Node, int]]) -> None:
    for node, action in reversed(path):
        if action == PASS:
            node.pass_n += 1
        else:
            assert node.child_n is not None
            node.child_n[action] += 1
        node.n_total += 1
        recompute(node)


def _simulate(
    root: Node, first_action: int, cfg: SearchConfig, rng: np.random.Generator
) -> Generator[Node, EvalResult, None]:
    """One simulation entering the root via ``first_action`` (PASS or arm index)."""
    path = [(root, first_action)]
    cur = ensure_pass_child(root) if first_action == PASS else ensure_cell_child(root, first_action)

    while cur.expanded and not cur.is_terminal:
        # Chance: the mover's turn fails with probability 1 - p(k*).
        if rng.random() >= SUCCESS_PROBABILITY[cur.kstar]:
            path.append((cur, PASS))
            cur = ensure_pass_child(cur)
        else:
            index = select_cell(cur, cfg.c_puct)
            path.append((cur, index))
            cur = ensure_cell_child(cur, index)

    if not cur.is_terminal:
        logits, value = yield cur
        expand(cur, logits, value, cfg.max_children, cfg.force_tactics)
    _backup(path)


def _sigma(q: float, max_visits: int, cfg: SearchConfig) -> float:
    """Gumbel MuZero's completed-Q transform."""
    return (cfg.c_visit + max_visits) * cfg.c_scale * q


def _sh_sims_per_round(budget: int, arms: int) -> list[int]:
    """Simulations per surviving arm for each sequential-halving round.

    Round 0 guarantees two sims per arm: the first only expands the child
    (returning the net prior), so a second descent is the minimum needed for
    real refinement — e.g. discovering the opponent's immediate win below a
    non-blocking move. Without it, unrefined arms keep stale optimistic Qs.
    """
    rounds = max(1, math.ceil(math.log2(arms))) if arms > 1 else 1
    sims = []
    remaining_arms = arms
    for round_index in range(rounds):
        minimum = 2 if round_index == 0 else 1
        sims.append(max(minimum, budget // (rounds * remaining_arms)))
        remaining_arms = max(1, remaining_arms // 2)
    return sims


def _policy_target(root: Node, cfg: SearchConfig) -> np.ndarray:
    assert root.logits is not None and root.cells is not None and root.child_n is not None
    scores = root.logits.astype(np.float64).copy()
    max_visits = int(root.child_n.max()) if len(root.child_n) else 0
    completed = np.full(scores.shape, root.value, dtype=np.float64)
    for i, cell in enumerate(root.cells):
        q = child_q(root, i)
        if q is not None:
            completed[cell] = q
    scores += (cfg.c_visit + max_visits) * cfg.c_scale * completed
    scores[~legal_mask(root.board)] = -np.inf
    scores -= scores.max()
    exp = np.exp(scores)
    return (exp / exp.sum()).astype(np.float32)


def run_search(
    board: np.ndarray,
    to_move: int,
    cfg: SearchConfig,
    rng: np.random.Generator,
) -> SearchGen:
    root = Node(board.copy(), to_move)
    logits, value = yield root
    expand(
        root,
        logits,
        value,
        cfg.max_children,
        cfg.force_tactics,
        root_solver_depth=cfg.solver_depth if cfg.force_tactics else 0,
    )
    assert root.cells is not None and root.logits is not None and root.child_n is not None

    # Root arm sampling (indices into root.cells). Forced win/block cells are
    # always arms so they enter the EV subset construction with refined Qs.
    base_scores = root.logits[root.cells].astype(np.float64)
    noisy_scores = (
        base_scores + rng.gumbel(size=len(base_scores)) if cfg.root_noise else base_scores
    )
    m = min(cfg.m_root_cells, len(root.cells))
    arms: list[int] = [int(a) for a in np.argsort(-noisy_scores, kind="stable")[:m]]
    for index in root.forced:
        if index not in arms:
            arms.append(index)

    # Refine Q_pass first; it feeds every EV computation below.
    for _ in range(cfg.pass_simulations):
        yield from _simulate(root, PASS, cfg, rng)

    # Sequential halving over the arms.
    active = list(arms)
    sims_per_round = _sh_sims_per_round(cfg.simulations, len(active))
    for round_index, sims in enumerate(sims_per_round):
        for arm in active:
            for _ in range(sims):
                yield from _simulate(root, arm, cfg, rng)
        if round_index < len(sims_per_round) - 1 and len(active) > 1:
            max_visits = int(root.child_n.max())

            def sh_score(arm: int, _max_visits: int = max_visits) -> float:
                q = child_q(root, arm)
                refined = _sigma(q, _max_visits, cfg) if q is not None else -math.inf
                return float(noisy_scores[arm]) + refined

            active.sort(key=sh_score, reverse=True)
            active = active[: max(1, len(active) // 2)]

    # Move construction: EV rule over the refined arm Qs.
    arm_qs = np.array(
        [q if (q := child_q(root, arm)) is not None else -math.inf for arm in arms],
        dtype=np.float64,
    )
    usable = arm_qs > -math.inf
    usable_arms = [arm for arm, ok in zip(arms, usable, strict=True) if ok]
    qs = arm_qs[usable]
    order, _ev = best_subset(qs, pass_q(root))
    cells = [int(root.cells[usable_arms[i]]) for i in order]

    return MoveResult(
        cells=cells,
        policy_target=_policy_target(root, cfg),
        root_value=float(root.value),
    )
