"""Plane encoding and dihedral augmentation."""

import json
from pathlib import Path

import numpy as np
import pytest

from ungomoku_ml.encoding import (
    DIHEDRAL_COUNT,
    cell_index,
    cell_xy,
    encode_batch,
    encode_board,
    transform_grid,
    transform_policy,
)
from ungomoku_ml.rules import PLAYER1, PLAYER2, board_from_string, new_board

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "encoding-vectors.json"


def test_cell_index_round_trip() -> None:
    assert cell_index(3, 7) == 7 * 15 + 3
    assert cell_xy(cell_index(3, 7)) == (3, 7)


def test_encode_board_basic() -> None:
    board = new_board()
    board[7, 3] = PLAYER1
    board[0, 14] = PLAYER2
    planes = encode_board(board, PLAYER1)
    assert planes.shape == (3, 15, 15)
    assert planes[0, 7, 3] == 1.0 and planes[1, 7, 3] == 0.0
    assert planes[1, 0, 14] == 1.0 and planes[0, 0, 14] == 0.0
    assert planes[2].min() == 1.0
    # Perspective flip.
    flipped = encode_board(board, PLAYER2)
    np.testing.assert_array_equal(flipped[0], planes[1])
    np.testing.assert_array_equal(flipped[1], planes[0])


def test_encode_batch_matches_single() -> None:
    rng = np.random.default_rng(3)
    boards = rng.integers(0, 3, size=(4, 15, 15)).astype(np.int8)
    to_moves = np.array([PLAYER1, PLAYER2, PLAYER1, PLAYER2], dtype=np.int8)
    batch = encode_batch(boards, to_moves)
    for i in range(4):
        np.testing.assert_array_equal(batch[i], encode_board(boards[i], int(to_moves[i])))


def test_dihedral_policy_matches_grid() -> None:
    rng = np.random.default_rng(11)
    policy = rng.random(225).astype(np.float32)
    for g in range(DIHEDRAL_COUNT):
        via_policy = transform_policy(policy, g)
        via_grid = transform_grid(policy.reshape(15, 15), g).reshape(-1)
        np.testing.assert_array_equal(via_policy, via_grid)
    np.testing.assert_array_equal(transform_policy(policy, 0), policy)


def test_dihedral_transforms_are_distinct_bijections() -> None:
    base = np.arange(225, dtype=np.float32)
    seen = set()
    for g in range(DIHEDRAL_COUNT):
        out = tuple(transform_policy(base, g).tolist())
        assert sorted(out) == sorted(base.tolist())
        seen.add(out)
    assert len(seen) == DIHEDRAL_COUNT


@pytest.mark.skipif(not FIXTURE_PATH.exists(), reason="run `ungomoku-ml gen-encoding-vectors`")
def test_encoding_matches_committed_fixture() -> None:
    data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    names = {"player1": PLAYER1, "player2": PLAYER2}
    assert any(case["inPlanes"] == 5 for case in data["cases"])
    for case in data["cases"]:
        board = board_from_string(case["board"])
        planes = encode_board(board, names[case["toMove"]], case["inPlanes"])
        np.testing.assert_array_equal(
            planes.reshape(-1), np.array(case["planes"], dtype=np.float32), err_msg=case["name"]
        )


def test_v2_planes_mark_tactical_cells() -> None:
    board = new_board()
    for x in (3, 4, 5, 6):
        board[7, x] = PLAYER1
    planes = encode_board(board, PLAYER1, 5)
    assert planes.shape == (5, 15, 15)
    # Mover's win cells: both open ends of the four.
    assert planes[3, 7, 2] == 1.0 and planes[3, 7, 7] == 1.0
    assert planes[3].sum() == 2.0
    assert planes[4].sum() == 0.0
    # Opponent's perspective: same cells appear as block cells.
    flipped = encode_board(board, PLAYER2, 5)
    assert flipped[4, 7, 2] == 1.0 and flipped[4, 7, 7] == 1.0
    assert flipped[3].sum() == 0.0
