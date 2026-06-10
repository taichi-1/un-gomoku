"""Turn resolution. Port of packages/core/turn.ts + packages/shared/random.ts.

RNG semantics replicated exactly:
- success check is strict: ``random() < probability``
- candidate selection index is ``floor(random() * len(candidates))``
- a failed turn consumes exactly one random value, a successful turn two
"""

import math
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from ungomoku_ml.rules.constants import SUCCESS_PROBABILITY
from ungomoku_ml.rules.win import check_win_at, is_board_full

RandomFn = Callable[[], float]

NO_WINNER = 0


@dataclass(frozen=True)
class TurnOutcome:
    success: bool
    placed: tuple[int, int] | None  # (x, y)
    game_over: bool
    winner: int  # NO_WINNER, PLAYER1, or PLAYER2
    is_draw: bool


def calculate_success(candidate_count: int, rand: float) -> bool:
    probability = SUCCESS_PROBABILITY.get(candidate_count)
    if probability is None:
        return False
    return rand < probability


def select_candidate_index(rand: float, count: int) -> int:
    return math.floor(rand * count)


def resolve_turn(
    board: np.ndarray,
    player: int,
    candidates: list[tuple[int, int]],
    next_rand: RandomFn,
) -> TurnOutcome:
    """Resolves one turn, mutating ``board`` in place on success.

    Assumes candidates are already validated. The caller alternates the
    player-to-move after every non-terminal turn (success or failure).
    """
    if not calculate_success(len(candidates), next_rand()):
        return TurnOutcome(
            success=False, placed=None, game_over=False, winner=NO_WINNER, is_draw=False
        )

    x, y = candidates[select_candidate_index(next_rand(), len(candidates))]
    board[y, x] = player

    if check_win_at(board, x, y, player):
        return TurnOutcome(
            success=True, placed=(x, y), game_over=True, winner=player, is_draw=False
        )

    if is_board_full(board):
        return TurnOutcome(
            success=True, placed=(x, y), game_over=True, winner=NO_WINNER, is_draw=True
        )

    return TurnOutcome(
        success=True, placed=(x, y), game_over=False, winner=NO_WINNER, is_draw=False
    )
