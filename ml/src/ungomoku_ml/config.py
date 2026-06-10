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


class ArenaConfig(_StrictModel):
    every_generations: int = Field(default=1, ge=1)
    games: int = Field(default=200, ge=2)
    promote_threshold: float = Field(default=0.55, ge=0.0, le=1.0)
    simulations: int = Field(default=32, ge=1)
    parallel_games: int = Field(default=64, ge=1)


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


def load_config(path: str | Path) -> RunConfig:
    with Path(path).open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return RunConfig.model_validate(data)
