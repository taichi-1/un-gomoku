"""Win/draw detection. Port of packages/core/win-detection.ts."""

import numpy as np

from ungomoku_ml.rules.board import EMPTY
from ungomoku_ml.rules.constants import BOARD_SIZE, WIN_LENGTH

# (dx, dy): horizontal, vertical, diagonal down-right, diagonal up-right.
_DIRECTIONS = ((1, 0), (0, 1), (1, 1), (1, -1))


def check_win_at(board: np.ndarray, x: int, y: int, player: int) -> bool:
    """True if the stone at (x, y) is part of a run of WIN_LENGTH or more."""
    for dx, dy in _DIRECTIONS:
        count = 1
        for i in range(1, WIN_LENGTH):
            cx, cy = x + dx * i, y + dy * i
            if 0 <= cx < BOARD_SIZE and 0 <= cy < BOARD_SIZE and board[cy, cx] == player:
                count += 1
            else:
                break
        for i in range(1, WIN_LENGTH):
            cx, cy = x - dx * i, y - dy * i
            if 0 <= cx < BOARD_SIZE and 0 <= cy < BOARD_SIZE and board[cy, cx] == player:
                count += 1
            else:
                break
        if count >= WIN_LENGTH:
            return True
    return False


def is_board_full(board: np.ndarray) -> bool:
    return bool(np.all(board != EMPTY))
