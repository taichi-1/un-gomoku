"""Generational training loop: self-play -> gradient steps -> arena gate."""

import json
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from tqdm import tqdm

from ungomoku_ml.agents import AgentSpec, net_agent
from ungomoku_ml.arena import play_match
from ungomoku_ml.config import RunConfig, SearchConfig
from ungomoku_ml.driver import run_games
from ungomoku_ml.evaluator import NetEvaluator
from ungomoku_ml.net import PolicyValueNet
from ungomoku_ml.replay import ReplayBuffer
from ungomoku_ml.rules import PLAYER1, other_player


@dataclass
class SelfplayStats:
    games: int
    positions: int
    p1_wins: int
    p2_wins: int
    draws: int
    avg_turns: float
    seconds: float


def pick_device(override: str | None = None) -> torch.device:
    if override:
        return torch.device(override)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def run_selfplay(
    evaluator: NetEvaluator,
    search_cfg: SearchConfig,
    games: int,
    parallel: int,
    max_turns: int,
    buffer: ReplayBuffer,
    seed: int,
    league_opponents: list[AgentSpec] | None = None,
    league_fraction: float = 0.0,
) -> SelfplayStats:
    learner = net_agent("selfplay", evaluator, search_cfg)
    use_league = bool(league_opponents) and league_fraction > 0.0
    n_pool = len(league_opponents) if league_opponents else 0
    league_cut = int(round(league_fraction * 1000))

    def league_for(index: int) -> tuple[bool, int, AgentSpec | None]:
        """(is_league, learner_side, opponent_spec) for a game index.

        Pure self-play games return (False, PLAYER1, None) and collect both
        sides. League games designate one side the learner (alternating for
        first/second balance) and cycle the opponent pool decorrelated from
        the learner's side; only the learner's positions are kept."""
        if not use_league or (index % 1000) >= league_cut:
            return (False, PLAYER1, None)
        learner_side = PLAYER1 if index % 2 == 0 else other_player(PLAYER1)
        opp = league_opponents[(index // 2) % n_pool]  # type: ignore[index]
        return (True, learner_side, opp)

    def agent_for(index: int, player: int) -> AgentSpec:
        is_lg, learner_side, opp = league_for(index)
        if is_lg and player != learner_side:
            assert opp is not None
            return opp
        return learner

    start = time.perf_counter()
    with tqdm(total=games, desc="selfplay", unit="game", leave=False) as progress:
        finished = run_games(
            n_games=games,
            parallel=parallel,
            agent_for=agent_for,
            seed=seed,
            max_turns=max_turns,
            collect_history=True,
            on_game_done=lambda _game: progress.update(1),
        )
    positions = 0
    p1 = p2 = draws = 0
    turns = 0
    for game in finished:
        assert game.history is not None
        is_lg, learner_side, _ = league_for(game.index)
        history = (
            [r for r in game.history if r.to_move == learner_side] if is_lg else game.history
        )
        positions += buffer.add_game(history, game.winner, game.final_board)
        turns += game.turns
        if game.winner == PLAYER1:
            p1 += 1
        elif game.winner == 0:
            draws += 1
        else:
            p2 += 1
    return SelfplayStats(
        games=len(finished),
        positions=positions,
        p1_wins=p1,
        p2_wins=p2,
        draws=draws,
        avg_turns=turns / max(1, len(finished)),
        seconds=time.perf_counter() - start,
    )


def train_steps(
    net: PolicyValueNet,
    optimizer: torch.optim.Optimizer,
    buffer: ReplayBuffer,
    steps: int,
    batch_size: int,
    lambda_mix: float,
    value_loss_weight: float,
    rng: np.random.Generator,
    device: torch.device,
    ownership_weight: float = 0.0,
) -> dict[str, float]:
    net.train()
    use_ownership = net.ownership_head is not None and ownership_weight > 0.0
    policy_total = value_total = ownership_total = 0.0
    for _ in tqdm(range(steps), desc="train", unit="step", leave=False):
        planes, target_pi, target_v, target_own = buffer.sample(batch_size, rng, lambda_mix)
        x = torch.from_numpy(planes).to(device)
        pi = torch.from_numpy(target_pi).to(device)
        v = torch.from_numpy(target_v).to(device)
        logits, value, ownership = net.forward_with_aux(x)
        policy_loss = -(pi * F.log_softmax(logits, dim=1)).sum(dim=1).mean()
        value_loss = F.mse_loss(value, v)
        loss = policy_loss + value_loss_weight * value_loss
        if use_ownership and ownership is not None and target_own is not None:
            own_target = torch.from_numpy(target_own).to(device)
            ownership_loss = F.cross_entropy(ownership, own_target)
            loss = loss + ownership_weight * ownership_loss
            ownership_total += float(ownership_loss.detach())
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()
        policy_total += float(policy_loss.detach())
        value_total += float(value_loss.detach())
    net.eval()
    out = {
        "policy_loss": policy_total / max(1, steps),
        "value_loss": value_total / max(1, steps),
    }
    if use_ownership:
        out["ownership_loss"] = ownership_total / max(1, steps)
    return out


def save_checkpoint(
    path: Path,
    net: PolicyValueNet,
    optimizer: torch.optim.Optimizer | None,
    generation: int,
    cfg: RunConfig,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "net": net.state_dict(),
            "opt": optimizer.state_dict() if optimizer is not None else None,
            "generation": generation,
            "net_config": cfg.net.model_dump(),
            "run_config": cfg.model_dump(),
        },
        path,
    )


def load_net(ckpt_path: str | Path, device: torch.device) -> tuple[PolicyValueNet, dict]:
    from ungomoku_ml.config import NetConfig

    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    net = PolicyValueNet(NetConfig(**ckpt["net_config"])).to(device)
    net.load_state_dict(ckpt["net"])
    net.eval()
    return net, ckpt


def distill(
    cfg: RunConfig,
    teacher_ckpt: str | Path,
    games: int,
    steps: int,
    out_path: str | Path,
    device_override: str | None = None,
) -> Path:
    """Bootstraps a (typically larger) student net from a teacher's self-play.

    The teacher plays `games` self-play games with the configured search; the
    student trains on those records, then `train --resume <out>` continues
    self-play with the student itself. Skips the slow scatter-play phase a
    fresh net would otherwise re-walk.
    """
    device = pick_device(device_override)
    torch.manual_seed(cfg.seed)
    np_rng = np.random.default_rng(cfg.seed)

    teacher, teacher_ckpt_data = load_net(teacher_ckpt, device)
    teacher_planes = int(teacher_ckpt_data["net_config"].get("in_planes", 3))
    student = PolicyValueNet(cfg.net).to(device)
    # Records store raw boards; the student's sampler re-encodes with its own
    # plane count, so teacher and student feature sets may differ freely.
    buffer = ReplayBuffer(
        cfg.replay.capacity, cfg.net.in_planes, store_ownership=cfg.net.aux_ownership
    )
    stats = run_selfplay(
        NetEvaluator(teacher, device, teacher_planes),
        cfg.search,
        games,
        cfg.selfplay.parallel_games,
        cfg.selfplay.max_turns,
        buffer,
        cfg.seed + 5_000_000,
    )
    print(
        f"distill selfplay (teacher): {stats.games} games, {stats.positions} positions, "
        f"{stats.seconds:.0f}s"
    )
    optimizer = torch.optim.AdamW(
        student.parameters(), lr=cfg.train.lr, weight_decay=cfg.train.weight_decay
    )
    losses = train_steps(
        student,
        optimizer,
        buffer,
        steps,
        cfg.train.batch_size,
        cfg.train.lambda_mix,
        cfg.train.value_loss_weight,
        np_rng,
        device,
        ownership_weight=cfg.train.ownership_weight,
    )
    print(f"distill train: policy {losses['policy_loss']:.4f}, value {losses['value_loss']:.4f}")
    out_path = Path(out_path)
    save_checkpoint(out_path, student, optimizer, 0, cfg)
    return out_path


def train(cfg: RunConfig, resume: str | None = None, device_override: str | None = None) -> Path:
    device = pick_device(device_override)
    torch.manual_seed(cfg.seed)
    np_rng = np.random.default_rng(cfg.seed)

    run_dir = Path("runs") / cfg.run_name
    run_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = run_dir / "metrics.jsonl"

    net = PolicyValueNet(cfg.net).to(device)
    optimizer = torch.optim.AdamW(
        net.parameters(), lr=cfg.train.lr, weight_decay=cfg.train.weight_decay
    )
    start_gen = 0
    if resume:
        ckpt = torch.load(resume, map_location=device, weights_only=False)
        net.load_state_dict(ckpt["net"])
        if ckpt.get("opt") is not None:
            optimizer.load_state_dict(ckpt["opt"])
            # The optimizer state restores the OLD lr/weight decay; the config
            # must win so lr schedules across resumes actually take effect.
            for group in optimizer.param_groups:
                group["lr"] = cfg.train.lr
                group["weight_decay"] = cfg.train.weight_decay
        start_gen = int(ckpt.get("generation", 0))
        print(f"resumed from {resume} at generation {start_gen} (lr={cfg.train.lr})")
    net.eval()

    best_net = PolicyValueNet(cfg.net).to(device)
    best_path = run_dir / "best.pt"
    if best_path.exists():
        best_ckpt = torch.load(best_path, map_location=device, weights_only=False)
        best_net.load_state_dict(best_ckpt["net"])
    else:
        best_net.load_state_dict(net.state_dict())
        save_checkpoint(best_path, net, None, start_gen, cfg)
    best_net.eval()

    buffer = ReplayBuffer(
        cfg.replay.capacity, cfg.net.in_planes, store_ownership=cfg.net.aux_ownership
    )
    evaluator = NetEvaluator(net, device, cfg.net.in_planes)
    best_evaluator = NetEvaluator(best_net, device, cfg.net.in_planes)

    league_specs: list[AgentSpec] = []
    if cfg.league.enabled and cfg.league.pool:
        # Frozen opponents play strong, low-noise; they are fixed targets, not
        # learners. Each loads its own net_config so mixed architectures / plane
        # counts coexist (the driver batches per evaluator id).
        opp_search = cfg.search.model_copy(update={"root_noise": False})
        for pool_path in cfg.league.pool:
            pp = Path(pool_path)
            if not pp.exists():
                print(f"league: skipping missing pool ckpt {pp}")
                continue
            opp_net, opp_ckpt = load_net(pp, device)
            opp_planes = int(opp_ckpt["net_config"].get("in_planes", 3))
            opp_eval = NetEvaluator(opp_net, device, opp_planes)
            league_specs.append(net_agent(f"league:{pp.stem}", opp_eval, opp_search))
        print(
            f"league: {len(league_specs)} frozen opponents loaded "
            f"(fraction={cfg.league.fraction})"
        )

    print(f"training on {device}; run dir: {run_dir.resolve()}")
    for gen in range(start_gen, cfg.generations):
        gen_start = time.perf_counter()
        selfplay_seed = cfg.seed + 1_000_000 + gen * cfg.selfplay.games_per_generation
        stats = run_selfplay(
            evaluator,
            cfg.search,
            cfg.selfplay.games_per_generation,
            cfg.selfplay.parallel_games,
            cfg.selfplay.max_turns,
            buffer,
            selfplay_seed,
            league_opponents=league_specs or None,
            league_fraction=cfg.league.fraction,
        )
        print(
            f"[gen {gen}] selfplay: {stats.games} games, {stats.positions} positions, "
            f"avg {stats.avg_turns:.1f} turns, {stats.seconds:.1f}s "
            f"({stats.games / max(stats.seconds, 1e-9):.2f} games/s), buffer {buffer.size}"
        )

        losses: dict[str, float] = {}
        if buffer.size >= cfg.replay.min_fill:
            losses = train_steps(
                net,
                optimizer,
                buffer,
                cfg.train.steps_per_generation,
                cfg.train.batch_size,
                cfg.train.lambda_mix,
                cfg.train.value_loss_weight,
                np_rng,
                device,
                ownership_weight=cfg.train.ownership_weight,
            )
            print(
                f"[gen {gen}] train: policy {losses['policy_loss']:.4f}, "
                f"value {losses['value_loss']:.4f}"
            )
        else:
            print(f"[gen {gen}] skipping training (buffer {buffer.size} < {cfg.replay.min_fill})")

        save_checkpoint(run_dir / f"ckpt_{gen:04d}.pt", net, optimizer, gen + 1, cfg)
        save_checkpoint(run_dir / "latest.pt", net, optimizer, gen + 1, cfg)

        gate: dict[str, float] = {}
        if (gen + 1) % cfg.arena.every_generations == 0:
            arena_search = cfg.search.model_copy(
                update={"simulations": cfg.arena.simulations, "root_noise": False}
            )
            result = play_match(
                net_agent("candidate", evaluator, arena_search),
                net_agent("best", best_evaluator, arena_search),
                games=cfg.arena.games,
                parallel=cfg.arena.parallel_games,
                seed=cfg.seed + 9_000_000 + gen,
                max_turns=cfg.selfplay.max_turns,
            )
            gate = {"gate_score": result.score_a}
            promoted = result.score_a >= cfg.arena.promote_threshold
            print(
                f"[gen {gen}] gate: {result.summary('candidate', 'best')} -> "
                f"{'PROMOTED' if promoted else 'kept'}"
            )
            if promoted:
                best_net.load_state_dict(net.state_dict())
                best_net.eval()
                save_checkpoint(best_path, net, None, gen + 1, cfg)

        with metrics_path.open("a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "generation": gen,
                        "games": stats.games,
                        "positions": stats.positions,
                        "avg_turns": stats.avg_turns,
                        "selfplay_seconds": stats.seconds,
                        "buffer": buffer.size,
                        "elapsed": time.perf_counter() - gen_start,
                        **losses,
                        **gate,
                    }
                )
                + "\n"
            )
    return run_dir
