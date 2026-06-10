"""Candidate validation. Port of packages/core/validation.ts."""

import numpy as np

from ungomoku_ml.rules.board import EMPTY
from ungomoku_ml.rules.constants import BOARD_SIZE, MAX_CANDIDATES

INVALID_COUNT = "invalid_candidate_count"
INVALID_POSITION = "invalid_candidate_position"


def is_valid_candidate(board: np.ndarray, x: int, y: int) -> bool:
    return 0 <= x < BOARD_SIZE and 0 <= y < BOARD_SIZE and board[y, x] == EMPTY


def validate_candidates(board: np.ndarray, candidates: list[tuple[int, int]]) -> str | None:
    """Returns None when valid, otherwise the error kind (matching the TS union)."""
    if len(candidates) < 1 or len(candidates) > MAX_CANDIDATES:
        return INVALID_COUNT
    for x, y in candidates:
        if not is_valid_candidate(board, x, y):
            return INVALID_POSITION
    return None
