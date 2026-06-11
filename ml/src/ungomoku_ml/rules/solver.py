"""Bounded forced-sequence solver for the racing meta (a stochastic-game VCF).

Answers: "assuming every placement lands (the dice cooperate), can ``player``
force an unstoppable position — a double threat or an outright win — within
``depth`` of their own forcing moves, against forced blocking?"

Forcing move = a placement creating at least one immediate winning cell. The
opponent is then forced to block it (any other reply loses outright in the
deterministic abstraction). Conservative soundness rule: if the forced block
creates ANY winning cell for the opponent, the line is abandoned — so a
reported forced win never relies on ignoring a counter-threat. Dice are
priced later by the search's EV machinery; the solver only nominates cells.
"""

import numpy as np

from ungomoku_ml.rules.board import EMPTY, other_player
from ungomoku_ml.rules.tactics import _five_windows, winning_cells

# Bound the branching: forcing candidates per node, strongest first.
MAX_FORCING_CANDIDATES = 12


def _threat_pair_cells(board: np.ndarray, player: int) -> dict[int, set[int]]:
    """cell -> set of win cells it would create (3-own/2-empty windows)."""
    threats: dict[int, set[int]] = {}
    for pair in _five_windows(board, player):
        if len(pair) != 2:
            continue
        a, b = pair
        threats.setdefault(a, set()).add(b)
        threats.setdefault(b, set()).add(a)
    return threats


def _forced_win_after(board: np.ndarray, player: int, depth: int) -> bool:
    """True if ``player`` (to move) has a forced win within ``depth`` forcing moves."""
    if depth <= 0:
        return False
    opponent = other_player(player)
    existing = {int(c) for c in winning_cells(board, player)}
    if existing:
        # A win-now cell exists; in the deterministic abstraction that's a win.
        return True

    threats = _threat_pair_cells(board, player)
    if not threats:
        return False
    # Strongest candidates first: more created threats = closer to a double.
    candidates = sorted(threats, key=lambda c: len(threats[c]), reverse=True)
    for cell in candidates[:MAX_FORCING_CANDIDATES]:
        created = threats[cell] - existing
        if not created:
            continue
        y, x = divmod(cell, board.shape[0])
        board[y, x] = player
        try:
            wins_now = winning_cells(board, player)
            if len(wins_now) >= 2:
                return True  # double threat: unstoppable next turn
            if len(wins_now) == 1:
                w = int(wins_now[0])
                wy, wx = divmod(w, board.shape[0])
                board[wy, wx] = opponent
                try:
                    # Conservative: the block must not create a counter-threat.
                    if len(winning_cells(board, opponent)) == 0 and _forced_win_after(
                        board, player, depth - 1
                    ):
                        return True
                finally:
                    board[wy, wx] = EMPTY
        finally:
            board[y, x] = EMPTY
    return False


def forcing_win_cells(board: np.ndarray, player: int, depth: int) -> np.ndarray:
    """Empty cells that INITIATE a forced win within ``depth`` forcing moves.

    Includes immediate win cells and double-threat cells (depth 1) plus
    deeper forcing sequences (depth >= 2). Flat indices, sorted.
    """
    if depth <= 0:
        return np.empty(0, dtype=np.int64)
    opponent = other_player(player)
    existing = {int(c) for c in winning_cells(board, player)}
    out: set[int] = set(existing)  # win-now cells trivially initiate

    threats = _threat_pair_cells(board, player)
    candidates = sorted(threats, key=lambda c: len(threats[c]), reverse=True)
    for cell in candidates[:MAX_FORCING_CANDIDATES]:
        if cell in out:
            continue
        created = threats[cell] - existing
        if not created:
            continue
        y, x = divmod(cell, board.shape[0])
        board[y, x] = player
        try:
            wins_now = winning_cells(board, player)
            if len(wins_now) >= 2:
                out.add(cell)
                continue
            if len(wins_now) == 1 and depth >= 2:
                w = int(wins_now[0])
                wy, wx = divmod(w, board.shape[0])
                board[wy, wx] = opponent
                try:
                    if len(winning_cells(board, opponent)) == 0 and _forced_win_after(
                        board, player, depth - 1
                    ):
                        out.add(cell)
                finally:
                    board[wy, wx] = EMPTY
        finally:
            board[y, x] = EMPTY
    return np.array(sorted(out), dtype=np.int64)
