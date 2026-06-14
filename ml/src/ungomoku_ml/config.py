"""Run configuration: pydantic models populated from YAML (configs/*.yaml).

Unknown keys are rejected (extra="forbid") so config typos fail fast.
"""

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NetConfig(_StrictModel):
    blocks: int = Field(default=6, ge=1)
    channels: int = Field(default=64, ge=4)
    # Input feature planes: 3 = stones + ones; 5 adds immediate win/block
    # cell masks (KataGo-style tactical features).
    in_planes: int = Field(default=3, ge=3, le=5)
    # KataGo-style auxiliary head predicting final cell ownership
    # (mover / opponent / empty at game end). Trains the trunk; not exported.
    aux_ownership: bool = False


class SearchConfig(_StrictModel):
    """Gumbel-style search over the subset+chance action structure."""

    max_children: int = Field(default=32, ge=2)
    m_root_cells: int = Field(default=16, ge=1)
    simulations: int = Field(default=64, ge=1)
    pass_simulations: int = Field(default=4, ge=0)
    c_puct: float = Field(default=1.5, gt=0)
    c_visit: float = Field(default=50.0, ge=0)
    c_scale: float = Field(default=1.0, gt=0)
    # Gumbel noise on root cell sampling (on for self-play, off for arena/inference).
    root_noise: bool = True
    # Always include immediate win/block cells as children and root arms.
    force_tactics: bool = True
    # Root-only forced-sequence solver depth (forcing moves to look ahead;
    # 0 disables). Initiating cells for both players join the forced arms.
    solver_depth: int = Field(default=3, ge=0, le=5)


class SelfplayConfig(_StrictModel):
    parallel_games: int = Field(default=256, ge=1)
    games_per_generation: int = Field(default=2000, ge=1)
    max_turns: int = Field(default=600, ge=10)


class ReplayConfig(_StrictModel):
    capacity: int = Field(default=500_000, ge=100)
    min_fill: int = Field(default=20_000, ge=1)


class TrainStepConfig(_StrictModel):
    batch_size: int = Field(default=512, ge=1)
    steps_per_generation: int = Field(default=1000, ge=0)
    lr: float = Field(default=2e-4, gt=0)
    weight_decay: float = Field(default=1e-4, ge=0)
    value_loss_weight: float = Field(default=1.0, ge=0)
    # Value target = (1 - lambda_mix) * game outcome + lambda_mix * root search value.
    # The heavy transition stochasticity makes pure outcomes very noisy.
    lambda_mix: float = Field(default=0.5, ge=0.0, le=1.0)
    # Weight of the auxiliary ownership loss (active when net.aux_ownership).
    ownership_weight: float = Field(default=0.15, ge=0.0)


class ArenaConfig(_StrictModel):
    every_generations: int = Field(default=1, ge=1)
    games: int = Field(default=200, ge=2)
    promote_threshold: float = Field(default=0.55, ge=0.0, le=1.0)
    simulations: int = Field(default=32, ge=1)
    parallel_games: int = Field(default=64, ge=1)


class LeagueConfig(_StrictModel):
    """Fictitious-self-play league: a fraction of self-play games are played
    against frozen past-best checkpoints (a diverse pool) instead of the
    current net. Counters self-play meta-collapse into a narrow racing
    equilibrium by widening the opponent (and thus value-target) distribution.
    Only the learner's own positions from league games enter the replay buffer.
    """

    enabled: bool = False
    # Fraction of self-play games pitting the learner vs a frozen pool opponent.
    fraction: float = Field(default=0.5, ge=0.0, le=1.0)
    # Checkpoint paths (relative to the ml/ cwd) forming the opponent pool.
    # Mixed architectures / plane counts are fine; each loads its own net_config.
    pool: list[str] = Field(default_factory=list)


class RunConfig(_StrictModel):
    run_name: str = "default"
    seed: int = 42
    generations: int = Field(default=60, ge=1)
    net: NetConfig = NetConfig()
    search: SearchConfig = SearchConfig()
    selfplay: SelfplayConfig = SelfplayConfig()
    replay: ReplayConfig = ReplayConfig()
    train: TrainStepConfig = TrainStepConfig()
    arena: ArenaConfig = ArenaConfig()
    league: LeagueConfig = LeagueConfig()


def load_config(path: str | Path) -> RunConfig:
    with Path(path).open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return RunConfig.model_validate(data)
