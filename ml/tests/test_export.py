"""ONNX export parity (slow: exercises torch.onnx + onnxruntime)."""

import pytest
import torch

from ungomoku_ml.config import NetConfig, RunConfig
from ungomoku_ml.export_onnx import export_onnx
from ungomoku_ml.net import PolicyValueNet
from ungomoku_ml.train_loop import save_checkpoint


@pytest.mark.slow
def test_export_round_trip(tmp_path) -> None:
    torch.manual_seed(0)
    cfg = RunConfig(net=NetConfig(blocks=2, channels=16))
    net = PolicyValueNet(cfg.net)
    ckpt_path = tmp_path / "tiny.pt"
    save_checkpoint(ckpt_path, net, None, 0, cfg)

    out_path = tmp_path / "tiny.onnx"
    export_onnx(ckpt_path, out_path, check=True)  # raises on torch/ORT divergence
    assert out_path.exists() and out_path.stat().st_size > 10_000

    import onnxruntime as ort

    session = ort.InferenceSession(str(out_path), providers=["CPUExecutionProvider"])
    outputs = [o.name for o in session.get_outputs()]
    assert outputs == ["policy_logits", "value"]
    batch_dim = session.get_inputs()[0].shape[0]
    assert not isinstance(batch_dim, int), f"batch dim should be dynamic, got {batch_dim}"
