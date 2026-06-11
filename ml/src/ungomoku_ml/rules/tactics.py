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


def _five_windows(board: np.ndarray, player: int):
    """Yields (cells, p_count, empty_cells) for every 5-in-a-row window.

    cells are flat indices; iteration is vectorized per direction with the
    per-window detail loop only over qualifying windows.
    """
    own = (board == player).astype(np.int8)
    empty = (board == EMPTY).astype(np.int8)
    size = board.shape[0]
    flat_index = np.arange(size * size).reshape(size, size)
    for dx, dy in _DIRECTIONS:
        # Window start ranges keeping all 5 cells in bounds.
        x0 = slice(0, size - 4 * dx) if dx > 0 else slice(0, size)
        if dy > 0:
            y0 = slice(0, size - 4 * dy)
        elif dy < 0:
            y0 = slice(4, size)
        else:
            y0 = slice(0, size)
        own_sum = np.zeros_like(own[y0, x0], dtype=np.int8)
        empty_sum = np.zeros_like(own_sum)
        for step in range(WIN_LENGTH):
            sy = slice(y0.start + dy * step, (y0.stop or size) + dy * step)
            sx = slice(x0.start + dx * step, (x0.stop or size) + dx * step)
            own_sum = own_sum + own[sy, sx]
            empty_sum = empty_sum + empty[sy, sx]
        starts_y, starts_x = np.nonzero((own_sum == WIN_LENGTH - 2) & (empty_sum == 2))
        for wy, wx in zip(starts_y, starts_x, strict=True):
            y = int(wy) + (y0.start or 0)
            x = int(wx) + (x0.start or 0)
            empties = []
            for step in range(WIN_LENGTH):
                cy, cx = y + dy * step, x + dx * step
                if board[cy, cx] == EMPTY:
                    empties.append(int(flat_index[cy, cx]))
            yield empties


def double_threat_cells(board: np.ndarray, player: int) -> np.ndarray:
    """Empty cells where placing ``player``'s stone yields >= 2 winning cells.

    A cell with two simultaneous winning threats is (probabilistically) almost
    unstoppable next turn — the core winning pattern of the racing meta.
    Windows with exactly 3 own stones + 2 empties contribute a threat pair:
    placing at one empty makes the other a winning cell.
    """
    existing = winning_cells(board, player)
    threats: dict[int, set[int]] = {}
    for pair in _five_windows(board, player):
        if len(pair) != 2:
            continue
        a, b = pair
        threats.setdefault(a, set()).add(b)
        threats.setdefault(b, set()).add(a)

    existing_set = {int(c) for c in existing}
    out = []
    for cell, raw_threats in threats.items():
        # Winning cells after placing at `cell` = new threats from windows
        # through it, united with pre-existing winning cells (minus itself).
        # The move must CREATE at least one new threat: with >= 2 pre-existing
        # winning cells every placement trivially "has two threats", but those
        # positions are handled by the forced win-cell logic.
        new_threats = raw_threats - existing_set
        if not new_threats:
            continue
        winning_after = new_threats | (existing_set - {cell})
        if len(winning_after) >= 2:
            out.append(cell)
    return np.array(sorted(out), dtype=np.int64)
