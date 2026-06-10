"""Network shape/range sanity."""

import numpy as np
import torch

from ungomoku_ml.config import NetConfig
from ungomoku_ml.net import PolicyValueNet


def test_forward_shapes_and_ranges() -> None:
    net = PolicyValueNet(NetConfig(blocks=2, channels=16))
    net.eval()
    x = torch.zeros(5, 3, 15, 15)
    x[:, 2] = 1.0
    logits, value = net(x)
    assert logits.shape == (5, 225)
    assert value.shape == (5,)
    assert torch.all(value <= 1.0) and torch.all(value >= -1.0)


def test_eval_deterministic_and_batch_consistent() -> None:
    torch.manual_seed(1)
    net = PolicyValueNet(NetConfig(blocks=2, channels=16))
    net.eval()
    rng = np.random.default_rng(2)
    x = torch.from_numpy(rng.random((4, 3, 15, 15)).astype(np.float32))
    with torch.no_grad():
        l1, v1 = net(x)
        l2, v2 = net(x)
        l_single, v_single = net(x[1:2])
    torch.testing.assert_close(l1, l2)
    torch.testing.assert_close(v1, v2)
    torch.testing.assert_close(l1[1:2], l_single, atol=1e-5, rtol=1e-5)
    torch.testing.assert_close(v1[1:2], v_single, atol=1e-5, rtol=1e-5)


def test_default_net_fits_browser_budget() -> None:
    net = PolicyValueNet(NetConfig())
    params = sum(p.numel() for p in net.parameters())
    # fp32 size must stay a few MB for Cloudflare Pages delivery.
    assert params < 1_500_000, f"{params} params is too large for the browser budget"
