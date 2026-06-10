"""Agents: a move is produced either directly (scripted) or via a search generator.

An agent's ``move`` callable receives (board, to_move, rng) and returns either
a MoveResult (scripted agents) or a generator (net agents) that the game
driver advances, batching its eval requests.
"""

from collections.abc import Callable, Generator
from dataclasses import dataclass

import numpy as np

from ungomoku_ml.config import SearchConfig
from ungomoku_ml.encoding import cell_index, cell_xy, legal_mask
from ungomoku_ml.evaluator import NetEvaluator
from ungomoku_ml.mcts.gumbel import MoveResult, run_search
from ungomoku_ml.rules import (
    BOARD_SIZE,
    EMPTY,
    MAX_CANDIDATES,
    other_player,
)
from ungomoku_ml.rules.win import check_win_at

MoveFn = Callable[[np.ndarray, int, np.random.Generator], "MoveResult | Generator"]


@dataclass
class AgentSpec:
    name: str
    move: MoveFn
    evaluator: NetEvaluator | None  # None for scripted agents


def net_agent(name: str, evaluator: NetEvaluator, search_cfg: SearchConfig) -> AgentSpec:
    def move(board: np.ndarray, to_move: int, rng: np.random.Generator):
        return run_search(board, to_move, search_cfg, rng)

    return AgentSpec(name=name, move=move, evaluator=evaluator)


def random_agent() -> AgentSpec:
    def move(board: np.ndarray, to_move: int, rng: np.random.Generator) -> MoveResult:
        empties = np.flatnonzero(legal_mask(board))
        k = min(int(rng.integers(1, MAX_CANDIDATES + 1)), len(empties))
        cells = rng.choice(empties, size=k, replace=False)
        return MoveResult(cells=[int(c) for c in cells], policy_target=None, root_value=0.0)

    return AgentSpec(name="random", move=move, evaluator=None)


# ── Scripted heuristic (arena baseline / sanity gate) ──


def _wins_at(board: np.ndarray, cell: int, player: int) -> bool:
    x, y = cell_xy(cell)
    board[y, x] = player
    won = check_win_at(board, x, y, player)
    board[y, x] = EMPTY
    return won


def _line_potential(board: np.ndarray, cell: int, player: int) -> float:
    """Scores how strong a run through ``cell`` would be for ``player``."""
    x, y = cell_xy(cell)
    total = 0.0
    for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
        run = 1
        for sign in (1, -1):
            for i in range(1, 5):
                cx, cy = x + sign * dx * i, y + sign * dy * i
                if 0 <= cx < BOARD_SIZE and 0 <= cy < BOARD_SIZE and board[cy, cx] == player:
                    run += 1
                else:
                    break
        total += float(4 ** min(run, 5))
    return total


def heuristic_agent() -> AgentSpec:
    """Win-now / block-now / best-pattern with k=3, used as a strength gate."""

    def move(board: np.ndarray, to_move: int, rng: np.random.Generator) -> MoveResult:
        empties = np.flatnonzero(legal_mask(board))
        my_wins = [int(c) for c in empties if _wins_at(board, int(c), to_move)]
        if my_wins:
            # All candidates win on success, so more candidates = higher p(k).
            return MoveResult(cells=my_wins[:MAX_CANDIDATES], policy_target=None, root_value=0.0)
        opponent = other_player(to_move)
        opp_wins = [int(c) for c in empties if _wins_at(board, int(c), opponent)]
        if opp_wins:
            return MoveResult(cells=opp_wins[:MAX_CANDIDATES], policy_target=None, root_value=0.0)

        center = (BOARD_SIZE - 1) / 2
        scores = np.empty(len(empties), dtype=np.float64)
        for i, cell in enumerate(empties):
            c = int(cell)
            x, y = cell_xy(c)
            centrality = -0.01 * (abs(x - center) + abs(y - center))
            scores[i] = (
                _line_potential(board, c, to_move)
                + 0.9 * _line_potential(board, c, opponent)
                + centrality
                + rng.random() * 1e-3
            )
        top = empties[np.argsort(-scores, kind="stable")[:3]]
        return MoveResult(cells=[int(c) for c in top], policy_target=None, root_value=0.0)

    return AgentSpec(name="heuristic", move=move, evaluator=None)


def cells_to_candidates(cells: list[int]) -> list[tuple[int, int]]:
    return [cell_xy(c) for c in cells]


__all__ = [
    "AgentSpec",
    "cell_index",
    "cells_to_candidates",
    "heuristic_agent",
    "net_agent",
    "random_agent",
]
