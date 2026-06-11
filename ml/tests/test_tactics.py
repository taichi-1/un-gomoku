"""Vectorized winning-cell detection vs brute force."""

import numpy as np
import pytest

from ungomoku_ml.encoding import cell_xy
from ungomoku_ml.rules import BOARD_SIZE, EMPTY, PLAYER1, PLAYER2, new_board
from ungomoku_ml.rules.tactics import double_threat_cells, winning_cells
from ungomoku_ml.rules.win import check_win_at


def brute_force_wins(board: np.ndarray, player: int) -> list[int]:
    cells = []
    for cell in range(BOARD_SIZE * BOARD_SIZE):
        x, y = cell_xy(cell)
        if board[y, x] != EMPTY:
            continue
        board[y, x] = player
        if check_win_at(board, x, y, player):
            cells.append(cell)
        board[y, x] = EMPTY
    return cells


def test_open_four_has_two_winning_cells() -> None:
    board = new_board()
    for x in (3, 4, 5, 6):
        board[7, x] = PLAYER1
    assert sorted(winning_cells(board, PLAYER1).tolist()) == [7 * 15 + 2, 7 * 15 + 7]
    assert winning_cells(board, PLAYER2).tolist() == []


def test_gap_completion_detected() -> None:
    board = new_board()
    for x in (0, 1, 3, 4):
        board[0, x] = PLAYER2
    assert 2 in winning_cells(board, PLAYER2).tolist()


@pytest.mark.parametrize("seed", range(30))
def test_matches_brute_force_on_random_boards(seed: int) -> None:
    rng = np.random.default_rng(seed)
    board = new_board()
    stones = int(rng.integers(10, 120))
    cells = rng.choice(BOARD_SIZE * BOARD_SIZE, size=stones, replace=False)
    for i, cell in enumerate(cells):
        x, y = cell_xy(int(cell))
        board[y, x] = PLAYER1 if i % 2 == 0 else PLAYER2
    for player in (PLAYER1, PLAYER2):
        assert sorted(winning_cells(board, player).tolist()) == brute_force_wins(board, player)


def brute_force_double_threats(board: np.ndarray, player: int) -> list[int]:
    """Placements yielding >= 2 winning cells, at least one newly created."""
    before = set(brute_force_wins(board, player))
    cells = []
    for cell in range(BOARD_SIZE * BOARD_SIZE):
        x, y = cell_xy(cell)
        if board[y, x] != EMPTY:
            continue
        board[y, x] = player
        after = set(brute_force_wins(board, player))
        board[y, x] = EMPTY
        if len(after) >= 2 and after - before:
            cells.append(cell)
    return cells


def test_open_three_creates_double_threats() -> None:
    # _XXX_: extending either end makes an open four = two winning cells.
    board = new_board()
    for x in (5, 6, 7):
        board[7, x] = PLAYER1
    threats = double_threat_cells(board, PLAYER1).tolist()
    assert 7 * 15 + 4 in threats
    assert 7 * 15 + 8 in threats
    assert double_threat_cells(board, PLAYER2).tolist() == []


def test_blocked_three_creates_no_double_threat() -> None:
    # OXXX__: extending gives a four with a single winning cell only.
    board = new_board()
    for x in (5, 6, 7):
        board[7, x] = PLAYER1
    board[7, 4] = PLAYER2
    assert double_threat_cells(board, PLAYER1).tolist() == []


@pytest.mark.parametrize("seed", range(20))
def test_double_threats_match_brute_force(seed: int) -> None:
    rng = np.random.default_rng(1000 + seed)
    board = new_board()
    stones = int(rng.integers(8, 80))
    cells = rng.choice(BOARD_SIZE * BOARD_SIZE, size=stones, replace=False)
    for i, cell in enumerate(cells):
        x, y = cell_xy(int(cell))
        board[y, x] = PLAYER1 if i % 2 == 0 else PLAYER2
    for player in (PLAYER1, PLAYER2):
        assert double_threat_cells(board, player).tolist() == brute_force_double_threats(
            board, player
        )
