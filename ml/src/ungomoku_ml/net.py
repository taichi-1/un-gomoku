"""AlphaZero-style policy/value network sized for browser WASM inference."""

import torch
import torch.nn.functional as F
from torch import nn

from ungomoku_ml.config import NetConfig
from ungomoku_ml.rules import BOARD_SIZE

CELLS = BOARD_SIZE * BOARD_SIZE


class ResidualBlock(nn.Module):
    def __init__(self, channels: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return F.relu(out + x)


class PolicyValueNet(nn.Module):
    """Input (B, in_planes, 15, 15) -> policy logits (B, 225), value (B,) in [-1, 1]."""

    def __init__(self, cfg: NetConfig) -> None:
        super().__init__()
        c = cfg.channels
        self.stem = nn.Sequential(
            nn.Conv2d(cfg.in_planes, c, 3, padding=1, bias=False),
            nn.BatchNorm2d(c),
            nn.ReLU(inplace=True),
        )
        self.trunk = nn.Sequential(*[ResidualBlock(c) for _ in range(cfg.blocks)])
        self.policy_head = nn.Sequential(
            nn.Conv2d(c, 2, 1, bias=False),
            nn.BatchNorm2d(2),
            nn.ReLU(inplace=True),
            nn.Flatten(),
            nn.Linear(2 * CELLS, CELLS),
        )
        self.value_head = nn.Sequential(
            nn.Conv2d(c, 1, 1, bias=False),
            nn.BatchNorm2d(1),
            nn.ReLU(inplace=True),
            nn.Flatten(),
            nn.Linear(CELLS, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
            nn.Tanh(),
        )
        # Auxiliary ownership head (training-time regularizer; not exported —
        # ONNX export traces forward(), which never touches it).
        self.ownership_head = nn.Conv2d(c, 3, 1) if cfg.aux_ownership else None

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        trunk = self.trunk(self.stem(x))
        return self.policy_head(trunk), self.value_head(trunk).squeeze(-1)

    def forward_with_aux(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor | None]:
        trunk = self.trunk(self.stem(x))
        ownership = self.ownership_head(trunk) if self.ownership_head is not None else None
        return (
            self.policy_head(trunk),
            self.value_head(trunk).squeeze(-1),
            ownership,
        )
