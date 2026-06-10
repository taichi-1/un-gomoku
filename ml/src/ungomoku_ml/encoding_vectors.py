"""Generates encoding parity fixtures consumed by the TS engine tests.

The TS feature encoder (apps/web .../lib/ai/features.ts) must feed the model
bit-identical planes; these vectors pin the convention.
"""

import json
from pathlib import Path

import numpy as np

from ungomoku_ml.encoding import cell_xy, encode_board
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


def build_cases() -> list[dict]:
    rng = np.random.default_rng(20260610)
    cases: list[dict] = []
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
        to_move = player
        planes = encode_board(board, to_move)
        cases.append(
            {
                "name": f"stones-{stones}",
                "board": board_to_string(board),
                "toMove": PLAYER_NAMES[to_move],
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
            ],
            "cellIndex": "y * boardSize + x (row-major, matches board strings)",
            "layout": "planes flattened as (plane, y, x), float32 0/1 values",
        },
        "cases": build_cases(),
    }
    out_path.write_text(json.dumps(data), encoding="utf-8")
    return out_path
