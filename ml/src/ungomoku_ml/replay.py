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
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.boards = np.zeros((capacity, BOARD_SIZE, BOARD_SIZE), dtype=np.int8)
        self.to_move = np.zeros(capacity, dtype=np.int8)
        self.policy = np.zeros((capacity, CELLS), dtype=np.float16)
        self.z = np.zeros(capacity, dtype=np.float32)
        self.nu = np.zeros(capacity, dtype=np.float32)
        self.size = 0
        self.cursor = 0
        self.total_added = 0

    def add_game(self, history: list[PositionRecord], winner: int) -> int:
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
            self.cursor = (self.cursor + 1) % self.capacity
            self.size = min(self.size + 1, self.capacity)
            self.total_added += 1
            added += 1
        return added

    def sample(
        self, batch_size: int, rng: np.random.Generator, lambda_mix: float
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Returns (planes (B,3,15,15) f32, policy (B,225) f32, value (B,) f32)."""
        idx = rng.integers(0, self.size, size=batch_size)
        planes = encode_batch(self.boards[idx], self.to_move[idx])
        policy = self.policy[idx].astype(np.float32)
        symmetry = rng.integers(0, DIHEDRAL_COUNT, size=batch_size)
        for g in range(1, DIHEDRAL_COUNT):
            mask = symmetry == g
            if mask.any():
                planes[mask] = transform_grid(planes[mask], g)
                policy[mask] = transform_policy(policy[mask], g)
        value = (1.0 - lambda_mix) * self.z[idx] + lambda_mix * self.nu[idx]
        return planes, policy, value.astype(np.float32)
