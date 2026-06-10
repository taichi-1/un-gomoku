"""Command-line entry point.

All commands are run from the ml/ directory (or via
`uv run --directory ml ungomoku-ml ...` from the repo root, which also sets
the working directory to ml/). Checkpoints and metrics land in runs/<name>/.
"""

import argparse
import contextlib
import sys


def _force_utf8_stdio() -> None:
    """Windows consoles default to cp1252; torch & friends print emoji."""
    for stream in (sys.stdout, sys.stderr):
        with contextlib.suppress(Exception):
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]


def _add_config_arg(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--config", default="configs/default.yaml", help="YAML run config")


def main() -> None:
    _force_utf8_stdio()
    parser = argparse.ArgumentParser(prog="ungomoku-ml")
    sub = parser.add_subparsers(dest="command", required=True)

    p_train = sub.add_parser("train", help="full loop: selfplay -> train -> gate, per generation")
    _add_config_arg(p_train)
    p_train.add_argument("--resume", default=None, help="checkpoint to resume from")
    p_train.add_argument("--device", default=None, help="cuda / cpu (default: auto)")

    p_selfplay = sub.add_parser("selfplay", help="selfplay only (throughput / sanity check)")
    _add_config_arg(p_selfplay)
    p_selfplay.add_argument("--games", type=int, default=None, help="override game count")
    p_selfplay.add_argument("--ckpt", default=None, help="checkpoint (default: fresh net)")
    p_selfplay.add_argument("--device", default=None)

    p_arena = sub.add_parser("arena", help="pit two agents")
    _add_config_arg(p_arena)
    agent_help = "ckpt path | heuristic | random | ts[:difficulty[:persona]]"
    p_arena.add_argument("--p1", required=True, help=agent_help)
    p_arena.add_argument("--p2", required=True, help=agent_help)
    p_arena.add_argument("--games", type=int, default=None)
    p_arena.add_argument("--sims", type=int, default=None, help="override search simulations")
    p_arena.add_argument("--device", default=None)
    p_arena.add_argument("--seed", type=int, default=20260611)

    p_distill = sub.add_parser("distill", help="bootstrap a student net from a teacher's selfplay")
    _add_config_arg(p_distill)
    p_distill.add_argument("--teacher", required=True, help="teacher checkpoint")
    p_distill.add_argument("--games", type=int, default=3000)
    p_distill.add_argument("--steps", type=int, default=3000)
    p_distill.add_argument("--out", required=True, help="output student checkpoint")
    p_distill.add_argument("--device", default=None)

    p_export = sub.add_parser("export", help="checkpoint -> ONNX (with ORT parity check)")
    p_export.add_argument("--ckpt", required=True)
    p_export.add_argument("--out", required=True)
    p_export.add_argument("--no-check", action="store_true")

    p_enc = sub.add_parser("gen-encoding-vectors", help="regenerate encoding parity fixtures")
    p_enc.add_argument("--out", default=None)

    args = parser.parse_args()

    if args.command == "train":
        from ungomoku_ml.config import load_config
        from ungomoku_ml.train_loop import train

        train(load_config(args.config), resume=args.resume, device_override=args.device)

    elif args.command == "selfplay":
        from ungomoku_ml.config import load_config
        from ungomoku_ml.evaluator import NetEvaluator
        from ungomoku_ml.net import PolicyValueNet
        from ungomoku_ml.replay import ReplayBuffer
        from ungomoku_ml.train_loop import load_net, pick_device, run_selfplay

        cfg = load_config(args.config)
        device = pick_device(args.device)
        if args.ckpt:
            net, _ = load_net(args.ckpt, device)
        else:
            net = PolicyValueNet(cfg.net).to(device)
            net.eval()
        buffer = ReplayBuffer(cfg.replay.capacity)
        games = args.games if args.games is not None else cfg.selfplay.games_per_generation
        stats = run_selfplay(
            NetEvaluator(net, device),
            cfg.search,
            games,
            cfg.selfplay.parallel_games,
            cfg.selfplay.max_turns,
            buffer,
            cfg.seed,
        )
        print(
            f"{stats.games} games in {stats.seconds:.1f}s "
            f"({stats.games / max(stats.seconds, 1e-9):.2f} games/s), "
            f"{stats.positions} positions, avg {stats.avg_turns:.1f} turns, "
            f"P1 {stats.p1_wins} / P2 {stats.p2_wins} / draw {stats.draws}"
        )

    elif args.command == "arena":
        from ungomoku_ml.agents import heuristic_agent, net_agent, random_agent
        from ungomoku_ml.arena import play_match
        from ungomoku_ml.config import load_config
        from ungomoku_ml.evaluator import NetEvaluator
        from ungomoku_ml.train_loop import load_net, pick_device

        cfg = load_config(args.config)
        device = pick_device(args.device)
        search = cfg.search.model_copy(
            update={
                "simulations": args.sims if args.sims is not None else cfg.arena.simulations,
                "root_noise": False,
            }
        )

        pools = []

        def make_agent(spec: str, label: str):
            if spec == "heuristic":
                return heuristic_agent()
            if spec == "random":
                return random_agent()
            if spec == "ts" or spec.startswith("ts:"):
                from ungomoku_ml.ts_bridge import TsOpponentPool, ts_opponent_agent

                parts = spec.split(":")
                pool = TsOpponentPool(
                    difficulty=parts[1] if len(parts) > 1 else "hard",
                    persona=parts[2] if len(parts) > 2 else "attacker",
                )
                pools.append(pool)
                return ts_opponent_agent(pool)
            net, _ = load_net(spec, device)
            return net_agent(label, NetEvaluator(net, device), search)

        try:
            agent_a = make_agent(args.p1, "p1")
            agent_b = make_agent(args.p2, "p2")
            games = args.games if args.games is not None else cfg.arena.games
            result = play_match(
                agent_a,
                agent_b,
                games=games,
                parallel=cfg.arena.parallel_games,
                seed=args.seed,
                max_turns=cfg.selfplay.max_turns,
            )
            print(result.summary(args.p1, args.p2))
        finally:
            for pool in pools:
                pool.close()

    elif args.command == "distill":
        from ungomoku_ml.config import load_config
        from ungomoku_ml.train_loop import distill

        out = distill(
            load_config(args.config),
            args.teacher,
            args.games,
            args.steps,
            args.out,
            device_override=args.device,
        )
        print(f"wrote {out}")

    elif args.command == "export":
        from ungomoku_ml.export_onnx import export_onnx

        out = export_onnx(args.ckpt, args.out, check=not args.no_check)
        print(f"wrote {out}")

    elif args.command == "gen-encoding-vectors":
        from ungomoku_ml.encoding_vectors import DEFAULT_OUT, generate

        out = generate(args.out or DEFAULT_OUT)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
