"""Search behavior on forced tactical positions.

Uses a scripted one-ply "tactical oracle" evaluator (no torch): it sees
immediate wins/threats only, mimicking a weakly trained net. Searches run
with root_noise=False so arm selection is deterministic; the only randomness
is the seeded chance sampling inside simulations.
"""

import numpy as np

from ungomoku_ml.config import SearchConfig
from ungomoku_ml.driver import drive_single
from ungomoku_ml.encoding import cell_index, cell_xy, legal_mask
from ungomoku_ml.mcts.gumbel import run_search
from ungomoku_ml.rules import EMPTY, PLAYER1, PLAYER2, new_board, other_player
from ungomoku_ml.rules.win import check_win_at

CFG = SearchConfig(
    max_children=32,
    m_root_cells=8,
    simulations=32,
    pass_simulations=2,
    root_noise=False,
)


def wins_at(board: np.ndarray, cell: int, player: int) -> bool:
    x, y = cell_xy(cell)
    board[y, x] = player
    won = check_win_at(board, x, y, player)
    board[y, x] = EMPTY
    return won


class TacticalOracle:
    """logits: +3 win-or-block cells, +1 near stones, -2 elsewhere.
    value: +0.9 if the mover can win now, -0.7 if the opponent could."""

    def __call__(self, nodes):
        logits = np.empty((len(nodes), 225), dtype=np.float32)
        values = np.empty(len(nodes), dtype=np.float32)
        for row, node in enumerate(nodes):
            board, mover = node.board, node.to_move
            opponent = other_player(mover)
            empties = np.flatnonzero(legal_mask(board))
            cell_logits = np.full(225, -2.0, dtype=np.float32)
            mover_can_win = False
            opponent_can_win = False
            occupied = np.argwhere(board != EMPTY)
            for cell in empties:
                c = int(cell)
                x, y = cell_xy(c)
                near = any(abs(int(sy) - y) <= 1 and abs(int(sx) - x) <= 1 for sy, sx in occupied)
                if near:
                    cell_logits[c] = 1.0
                if wins_at(board, c, mover):
                    cell_logits[c] = 3.0
                    mover_can_win = True
                elif wins_at(board, c, opponent):
                    cell_logits[c] = 3.0
                    opponent_can_win = True
            logits[row] = cell_logits
            values[row] = 0.9 if mover_can_win else (-0.7 if opponent_can_win else 0.0)
        return logits, values


def search_move(board, to_move, seed=5):
    gen = run_search(board, to_move, CFG, np.random.default_rng(seed))
    return drive_single(gen, TacticalOracle())


def test_single_win_cell_played_alone() -> None:
    board = new_board()
    for x in (3, 4, 5, 6):
        board[7, x] = PLAYER1
    board[7, 2] = PLAYER2  # one end blocked -> only (7,7) wins
    result = search_move(board, PLAYER1)
    assert result.cells == [cell_index(7, 7)]
    assert result.root_value > 0.5
    assert result.policy_target is not None
    assert result.policy_target.shape == (225,)
    assert abs(float(result.policy_target.sum()) - 1.0) < 1e-5
    assert np.argmax(result.policy_target) == cell_index(7, 7)


def test_open_four_offers_both_win_cells() -> None:
    board = new_board()
    for x in (3, 4, 5, 6):
        board[7, x] = PLAYER1
    result = search_move(board, PLAYER1)
    # Both winning cells must lead the subset (k=2 beats k=1: 0.6 vs 0.5 win
    # probability). Trailing cells are allowed: with an open four the position
    # is won regardless, so near-1.0 Q cells can make k=3 genuinely optimal.
    assert sorted(result.cells[:2]) == sorted([cell_index(2, 7), cell_index(7, 7)])
    assert result.root_value > 0.5


def test_must_block_opponent_four() -> None:
    board = new_board()
    for x in (3, 4, 5, 6):
        board[7, x] = PLAYER2
    board[7, 2] = PLAYER1  # opponent's only winning cell is (7,7)
    result = search_move(board, PLAYER1)
    assert result.cells[0] == cell_index(7, 7)
    assert result.root_value < 0.0  # still behind even after blocking


def test_policy_target_zero_on_illegal_cells() -> None:
    board = new_board()
    board[7, 7] = PLAYER1
    board[7, 8] = PLAYER2
    result = search_move(board, PLAYER1)
    assert result.policy_target is not None
    assert result.policy_target[cell_index(7, 7)] == 0.0
    assert result.policy_target[cell_index(8, 7)] == 0.0


class BlindOracle:
    """Proximity-only policy, constant zero value: sees no tactics at all."""

    def __call__(self, nodes):
        logits = np.empty((len(nodes), 225), dtype=np.float32)
        values = np.zeros(len(nodes), dtype=np.float32)
        for row, node in enumerate(nodes):
            board = node.board
            cell_logits = np.full(225, -2.0, dtype=np.float32)
            occupied = np.argwhere(board != EMPTY)
            for cell in np.flatnonzero(legal_mask(board)):
                c = int(cell)
                x, y = cell_xy(c)
                if any(abs(int(sy) - y) <= 1 and abs(int(sx) - x) <= 1 for sy, sx in occupied):
                    cell_logits[c] = 1.0
            logits[row] = cell_logits
        return logits, values


def test_forced_tactics_block_with_tactics_blind_net() -> None:
    """Even a net that proposes nothing tactical must block via forced cells."""
    board = new_board()
    for x in (3, 4, 5, 6):
        board[7, x] = PLAYER2
    board[7, 2] = PLAYER1  # opponent's only winning cell is (7,7)
    gen = run_search(board, PLAYER1, CFG, np.random.default_rng(5))
    result = drive_single(gen, BlindOracle())
    assert result.cells[0] == cell_index(7, 7)


def test_forced_tactics_win_with_tactics_blind_net() -> None:
    board = new_board()
    for x in (3, 4, 5, 6):
        board[7, x] = PLAYER1
    board[7, 2] = PLAYER2
    gen = run_search(board, PLAYER1, CFG, np.random.default_rng(5))
    result = drive_single(gen, BlindOracle())
    assert result.cells[0] == cell_index(7, 7)
    assert result.root_value > 0.4


def test_search_is_deterministic_given_seed() -> None:
    board = new_board()
    board[7, 7] = PLAYER1
    board[8, 8] = PLAYER2
    a = search_move(board.copy(), PLAYER1, seed=9)
    b = search_move(board.copy(), PLAYER1, seed=9)
    assert a.cells == b.cells
    np.testing.assert_array_equal(a.policy_target, b.policy_target)
