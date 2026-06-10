"""Board -> network input planes, plus dihedral augmentation.

Conventions (mirrored exactly by the TS engine in apps/web — see
tests/fixtures/encoding-vectors.json):
- flat cell index = y * BOARD_SIZE + x (row-major, same as board strings)
- planes, float32, shape (3, 15, 15):
    0: cells occupied by the player to move
    1: cells occupied by the opponent
    2: all ones (edge awareness)
"""

import numpy as np

from ungomoku_ml.rules import BOARD_SIZE, EMPTY, other_player

PLANES = 3


def cell_index(x: int, y: int) -> int:
    return y * BOARD_SIZE + x


def cell_xy(index: int) -> tuple[int, int]:
    return index % BOARD_SIZE, index // BOARD_SIZE


def encode_board(board: np.ndarray, to_move: int) -> np.ndarray:
    planes = np.empty((PLANES, BOARD_SIZE, BOARD_SIZE), dtype=np.float32)
    planes[0] = board == to_move
    planes[1] = board == other_player(to_move)
    planes[2] = 1.0
    return planes


def encode_batch(boards: np.ndarray, to_moves: np.ndarray) -> np.ndarray:
    """boards (B, 15, 15) int8, to_moves (B,) -> (B, 3, 15, 15) float32."""
    movers = to_moves[:, None, None]
    planes = np.empty((boards.shape[0], PLANES, BOARD_SIZE, BOARD_SIZE), dtype=np.float32)
    planes[:, 0] = boards == movers
    planes[:, 1] = (boards != movers) & (boards != EMPTY)
    planes[:, 2] = 1.0
    return planes


def legal_mask(board: np.ndarray) -> np.ndarray:
    """(225,) bool mask of empty cells in flat-index order."""
    return (board == EMPTY).reshape(-1)


# ── Dihedral group (8 symmetries) for training augmentation ──

DIHEDRAL_COUNT = 8


def transform_grid(grid: np.ndarray, g: int) -> np.ndarray:
    """Applies symmetry g (0..7) to the trailing two (15, 15) axes."""
    rotated = np.rot90(grid, k=g % 4, axes=(-2, -1))
    if g >= 4:
        rotated = np.flip(rotated, axis=-1)
    return rotated


def transform_policy(policy: np.ndarray, g: int) -> np.ndarray:
    """Applies symmetry g to a flat (..., 225) policy vector."""
    grid = policy.reshape(*policy.shape[:-1], BOARD_SIZE, BOARD_SIZE)
    return np.ascontiguousarray(transform_grid(grid, g)).reshape(*policy.shape[:-1], -1)
