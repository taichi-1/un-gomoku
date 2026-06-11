"""Generates encoding parity fixtures consumed by the TS engine tests.

The TS feature encoder (apps/web .../lib/ai/features.ts) must feed the model
bit-identical planes; these vectors pin the convention for both the v1
(3-plane) and v2 (5-plane, tactical win/block masks) feature sets.
"""

import json
from pathlib import Path

import numpy as np

from ungomoku_ml.encoding import PLANES, PLANES_V2, cell_xy, encode_board
from ungomoku_ml.rules import (
    BOARD_SIZE,
    PLAYER1,
    PLAYER2,
    board_to_string,
    new_board,
    other_player,
)

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "encoding-vectors.json"

PLAYER_NAMES = {PLAYER1: "player1", PLAYER2: "player2"}


def _random_boards() -> list[tuple[str, np.ndarray, int]]:
    rng = np.random.default_rng(20260610)
    boards: list[tuple[str, np.ndarray, int]] = []
    for stones in (0, 1, 6, 24, 60, 120, 200):
        board = new_board()
        player = PLAYER1
        empties = list(range(BOARD_SIZE * BOARD_SIZE))
        for _ in range(stones):
            pick = int(rng.integers(0, len(empties)))
            cell = empties.pop(pick)
            x, y = cell_xy(cell)
            board[y, x] = player
            player = other_player(player)
        boards.append((f"stones-{stones}", board, player))
    return boards


def _tactical_boards() -> list[tuple[str, np.ndarray, int]]:
    """Positions with live win/block cells so the v2 planes are non-trivial."""
    open_four = new_board()
    for x in (3, 4, 5, 6):
        open_four[7, x] = PLAYER1
    open_four[0, 14] = PLAYER2

    must_block = new_board()
    for x in (3, 4, 5, 6):
        must_block[7, x] = PLAYER2
    must_block[7, 2] = PLAYER1

    both_threats = new_board()
    for x in (0, 1, 2, 3):
        both_threats[0, x] = PLAYER1
    for y in (5, 6, 7, 8):
        both_threats[y, 14] = PLAYER2

    return [
        ("tactical-open-four", open_four, PLAYER1),
        ("tactical-must-block", must_block, PLAYER1),
        ("tactical-both-threats", both_threats, PLAYER1),
    ]


def build_cases() -> list[dict]:
    cases: list[dict] = []
    boards = _random_boards() + _tactical_boards()
    for in_planes in (PLANES, PLANES_V2):
        for name, board, to_move in boards:
            planes = encode_board(board, to_move, in_planes)
            cases.append(
                {
                    "name": f"{name}-p{in_planes}",
                    "board": board_to_string(board),
                    "toMove": PLAYER_NAMES[to_move],
                    "inPlanes": in_planes,
                    "planes": [int(v) for v in planes.reshape(-1)],
                }
            )
    return cases


def generate(out_path: str | Path = DEFAULT_OUT) -> Path:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "meta": {
            "generator": "ml: ungomoku-ml gen-encoding-vectors",
            "boardSize": BOARD_SIZE,
            "planes": [
                "stones of the player to move",
                "stones of the opponent",
                "all ones",
                "v2 only: empty cells where the mover wins immediately",
                "v2 only: empty cells where the opponent wins immediately",
            ],
            "cellIndex": "y * boardSize + x (row-major, matches board strings)",
            "layout": "planes flattened as (plane, y, x), float32 0/1 values",
        },
        "cases": build_cases(),
    }
    out_path.write_text(json.dumps(data), encoding="utf-8")
    return out_path
