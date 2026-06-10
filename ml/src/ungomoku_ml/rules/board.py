"""Board representation: (15, 15) int8 numpy array indexed as board[y, x]."""

import numpy as np

from ungomoku_ml.rules.constants import BOARD_SIZE

EMPTY = 0
PLAYER1 = 1
PLAYER2 = 2

_CELL_CHARS = {EMPTY: ".", PLAYER1: "1", PLAYER2: "2"}
_CHAR_CELLS = {char: cell for cell, char in _CELL_CHARS.items()}


def new_board() -> np.ndarray:
    return np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.int8)


def other_player(player: int) -> int:
    return PLAYER2 if player == PLAYER1 else PLAYER1


def board_to_string(board: np.ndarray) -> str:
    """Row-major string, same encoding as the parity vector fixtures."""
    return "".join(_CELL_CHARS[int(cell)] for row in board for cell in row)


def board_from_string(text: str) -> np.ndarray:
    if len(text) != BOARD_SIZE * BOARD_SIZE:
        raise ValueError(f"expected {BOARD_SIZE * BOARD_SIZE} chars, got {len(text)}")
    flat = np.array([_CHAR_CELLS[char] for char in text], dtype=np.int8)
    return flat.reshape(BOARD_SIZE, BOARD_SIZE)
