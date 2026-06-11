"""Ring-buffer replay of self-play positions with dihedral augmentation."""

import numpy as np

from ungomoku_ml.driver import PositionRecord
from ungomoku_ml.encoding import (
    DIHEDRAL_COUNT,
    encode_batch,
    transform_grid,
    transform_policy,
)
from ungomoku_ml.net import CELLS
from ungomoku_ml.rules import BOARD_SIZE


class ReplayBuffer:
    def __init__(self, capacity: int, in_planes: int = 3, store_ownership: bool = False):
        self.capacity = capacity
        self.in_planes = in_planes
        self.store_ownership = store_ownership
        self.boards = np.zeros((capacity, BOARD_SIZE, BOARD_SIZE), dtype=np.int8)
        self.to_move = np.zeros(capacity, dtype=np.int8)
        self.policy = np.zeros((capacity, CELLS), dtype=np.float16)
        self.z = np.zeros(capacity, dtype=np.float32)
        self.nu = np.zeros(capacity, dtype=np.float32)
        self.final_boards = (
            np.zeros((capacity, BOARD_SIZE, BOARD_SIZE), dtype=np.int8) if store_ownership else None
        )
        self.size = 0
        self.cursor = 0
        self.total_added = 0

    def add_game(
        self,
        history: list[PositionRecord],
        winner: int,
        final_board: np.ndarray | None = None,
    ) -> int:
        added = 0
        for record in history:
            if record.policy is None:
                continue
            z = 0.0 if winner == 0 else (1.0 if winner == record.to_move else -1.0)
            i = self.cursor
            self.boards[i] = record.board
            self.to_move[i] = record.to_move
            self.policy[i] = record.policy
            self.z[i] = z
            self.nu[i] = record.root_value
            if self.final_boards is not None:
                if final_board is None:
                    raise ValueError("ownership storage requires the game's final board")
                self.final_boards[i] = final_board
            self.cursor = (self.cursor + 1) % self.capacity
            self.size = min(self.size + 1, self.capacity)
            self.total_added += 1
            added += 1
        return added

    def sample(
        self, batch_size: int, rng: np.random.Generator, lambda_mix: float
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray | None]:
        """Returns (planes (B,P,15,15) f32, policy (B,225) f32, value (B,) f32,
        ownership (B,15,15) int64 class grid or None).

        Ownership classes are mover-relative: 0 = empty at game end,
        1 = mover's stone, 2 = opponent's stone.
        """
        idx = rng.integers(0, self.size, size=batch_size)
        planes = encode_batch(self.boards[idx], self.to_move[idx], self.in_planes)
        policy = self.policy[idx].astype(np.float32)

        ownership: np.ndarray | None = None
        if self.final_boards is not None:
            finals = self.final_boards[idx]
            movers = self.to_move[idx][:, None, None]
            ownership = np.zeros(finals.shape, dtype=np.int64)
            ownership[finals == movers] = 1
            ownership[(finals != movers) & (finals != 0)] = 2

        symmetry = rng.integers(0, DIHEDRAL_COUNT, size=batch_size)
        for g in range(1, DIHEDRAL_COUNT):
            mask = symmetry == g
            if mask.any():
                planes[mask] = transform_grid(planes[mask], g)
                policy[mask] = transform_policy(policy[mask], g)
                if ownership is not None:
                    ownership[mask] = transform_grid(ownership[mask], g)
        value = (1.0 - lambda_mix) * self.z[idx] + lambda_mix * self.nu[idx]
        return planes, policy, value.astype(np.float32), ownership
