"""Batched network evaluation for search nodes."""

import numpy as np
import torch

from ungomoku_ml.encoding import encode_batch
from ungomoku_ml.mcts.node import Node
from ungomoku_ml.net import PolicyValueNet


class NetEvaluator:
    """Evaluates batches of nodes with a (frozen, eval-mode) network."""

    def __init__(self, net: PolicyValueNet, device: torch.device, in_planes: int = 3):
        self.net = net
        self.device = device
        self.in_planes = in_planes

    @torch.no_grad()
    def __call__(self, nodes: list[Node]) -> tuple[np.ndarray, np.ndarray]:
        boards = np.stack([node.board for node in nodes])
        to_moves = np.array([node.to_move for node in nodes], dtype=np.int8)
        planes = torch.from_numpy(encode_batch(boards, to_moves, self.in_planes)).to(self.device)
        was_training = self.net.training
        if was_training:
            self.net.eval()
        logits, values = self.net(planes)
        if was_training:
            self.net.train()
        return (
            logits.float().cpu().numpy(),
            values.float().cpu().numpy(),
        )
