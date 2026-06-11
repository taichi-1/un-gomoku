"""Checkpoint -> ONNX export for browser inference (onnxruntime-web)."""

from pathlib import Path

import numpy as np
import torch

from ungomoku_ml.train_loop import load_net


def export_onnx(ckpt_path: str | Path, out_path: str | Path, check: bool = True) -> Path:
    device = torch.device("cpu")
    net, ckpt = load_net(ckpt_path, device)
    net.eval()
    in_planes = int(ckpt["net_config"].get("in_planes", 3))

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    example = torch.zeros(2, in_planes, 15, 15)
    program = torch.onnx.export(
        net,
        (example,),
        dynamo=True,
        dynamic_shapes=({0: "batch"},),
        input_names=["board"],
        output_names=["policy_logits", "value"],
    )
    assert program is not None
    program.optimize()
    program.save(str(out_path))

    if check:
        _verify(net, out_path, in_planes)
    return out_path


def _verify(net: torch.nn.Module, onnx_path: Path, in_planes: int, tolerance: float = 1e-4) -> None:
    import onnxruntime as ort

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    rng = np.random.default_rng(0)
    for batch in (1, 7):
        planes = np.zeros((batch, in_planes, 15, 15), dtype=np.float32)
        stones = rng.random((batch, 15, 15)) < 0.3
        colors = rng.random((batch, 15, 15)) < 0.5
        planes[:, 0] = stones & colors
        planes[:, 1] = stones & ~colors
        planes[:, 2] = 1.0
        with torch.no_grad():
            torch_logits, torch_value = net(torch.from_numpy(planes))
        ort_logits, ort_value = session.run(None, {input_name: planes})
        max_diff = max(
            float(np.abs(torch_logits.numpy() - ort_logits).max()),
            float(np.abs(torch_value.numpy() - ort_value.reshape(-1)).max()),
        )
        if max_diff > tolerance:
            raise RuntimeError(f"ONNX/torch divergence {max_diff:.2e} > {tolerance:.0e}")
    print(f"export verified: torch vs onnxruntime max diff <= {tolerance:.0e}")
