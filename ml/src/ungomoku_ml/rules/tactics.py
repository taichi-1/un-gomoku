"""Vectorized tactical cell detection (immediate wins).

Used by the search to force win-now / block-now cells into the candidate set
regardless of policy priors. Self-play otherwise discovers defense very
slowly: blocking cells sit on the opponent's line, which a rush-biased policy
never proposes, so they rarely enter the sampled root arms.
"""

import numpy as np

from ungomoku_ml.rules.board import EMPTY
from ungomoku_ml.rules.constants import WIN_LENGTH

_DIRECTIONS = ((1, 0), (0, 1), (1, 1), (1, -1))


def _shift(mask: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """Shifts a (15, 15) bool mask by (dx, dy), zero-filling the border.

    out[y, x] = mask[y + dy, x + dx] (False outside the board).
    """
    out = np.zeros_like(mask)
    h, w = mask.shape
    src_y = slice(max(dy, 0), h + min(dy, 0))
    src_x = slice(max(dx, 0), w + min(dx, 0))
    dst_y = slice(max(-dy, 0), h + min(-dy, 0))
    dst_x = slice(max(-dx, 0), w + min(-dx, 0))
    out[dst_y, dst_x] = mask[src_y, src_x]
    return out


def winning_cells_mask(board: np.ndarray, player: int) -> np.ndarray:
    """(15, 15) bool: empty cells where placing ``player``'s stone wins now."""
    own = board == player
    empty = board == EMPTY
    wins = np.zeros_like(empty)
    for dx, dy in _DIRECTIONS:
        # consecutive own stones extending forward / backward from each cell
        fwd = np.zeros(board.shape, dtype=np.int8)
        bwd = np.zeros(board.shape, dtype=np.int8)
        run_f = np.ones(board.shape, dtype=bool)
        run_b = np.ones(board.shape, dtype=bool)
        for step in range(1, WIN_LENGTH):
            run_f &= _shift(own, dx * step, dy * step)
            run_b &= _shift(own, -dx * step, -dy * step)
            fwd += run_f
            bwd += run_b
        wins |= (1 + fwd + bwd) >= WIN_LENGTH
    return wins & empty


def winning_cells(board: np.ndarray, player: int) -> np.ndarray:
    """Flat indices (y * 15 + x) of immediate winning cells for ``player``."""
    return np.flatnonzero(winning_cells_mask(board, player).reshape(-1))
