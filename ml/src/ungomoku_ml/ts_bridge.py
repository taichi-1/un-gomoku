"""Arena agent backed by the legacy TS expectiminimax via JSONL stdio.

Spawns `bun run tools/parity-arena/src/ts-opponent.ts` subprocesses (a small
pool, assigned per game) and exchanges one JSON line per move. Set BUN_BIN if
`bun` is not on PATH.
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np

from ungomoku_ml.agents import AgentSpec
from ungomoku_ml.encoding import cell_index
from ungomoku_ml.mcts.gumbel import MoveResult
from ungomoku_ml.rules import PLAYER1, board_to_string

REPO_ROOT = Path(__file__).resolve().parents[3]
OPPONENT_SCRIPT = "tools/parity-arena/src/ts-opponent.ts"


def _bun_command() -> list[str]:
    bun = os.environ.get("BUN_BIN") or shutil.which("bun")
    if bun is None:
        raise RuntimeError("bun not found; set BUN_BIN or add bun to PATH")
    return [bun, "run", OPPONENT_SCRIPT]


class TsOpponentPool:
    """A pool of ts-opponent subprocesses; one synchronous request per move."""

    def __init__(self, size: int = 4, difficulty: str = "hard", persona: str = "attacker"):
        self.difficulty = difficulty
        self.persona = persona
        command = _bun_command()
        self.procs = [
            subprocess.Popen(
                command,
                cwd=REPO_ROOT,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
            )
            for _ in range(size)
        ]

    def request_move(self, slot: int, board: np.ndarray, player: int) -> list[int]:
        proc = self.procs[slot % len(self.procs)]
        assert proc.stdin is not None and proc.stdout is not None
        payload = {
            "board": board_to_string(board),
            "player": "player1" if player == PLAYER1 else "player2",
            "difficulty": self.difficulty,
            "persona": self.persona,
        }
        proc.stdin.write(json.dumps(payload) + "\n")
        proc.stdin.flush()
        line = proc.stdout.readline()
        if not line:
            raise RuntimeError("ts-opponent process closed its stdout")
        candidates = json.loads(line)["candidates"]
        return [cell_index(x, y) for x, y in candidates]

    def close(self) -> None:
        for proc in self.procs:
            if proc.stdin is not None:
                proc.stdin.close()
            proc.terminate()

    def __enter__(self) -> "TsOpponentPool":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()


def ts_opponent_agent(pool: TsOpponentPool) -> AgentSpec:
    counter = {"next": 0}
    assignments: dict[int, int] = {}

    def move(board: np.ndarray, to_move: int, rng: np.random.Generator) -> MoveResult:
        # Stable per-rng-identity slot assignment keeps a game on one process.
        key = id(rng)
        if key not in assignments:
            assignments[key] = counter["next"]
            counter["next"] += 1
        cells = pool.request_move(assignments[key], board, to_move)
        return MoveResult(cells=cells, policy_target=None, root_value=0.0)

    return AgentSpec(name=f"ts-{pool.difficulty}", move=move, evaluator=None)
