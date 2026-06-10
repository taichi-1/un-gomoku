"""Game driver, scripted agents, replay buffer, and a tiny net self-play smoke."""

import numpy as np
import torch

from ungomoku_ml.agents import heuristic_agent, net_agent, random_agent
from ungomoku_ml.arena import play_match
from ungomoku_ml.config import NetConfig, SearchConfig
from ungomoku_ml.driver import run_games
from ungomoku_ml.evaluator import NetEvaluator
from ungomoku_ml.net import PolicyValueNet
from ungomoku_ml.replay import ReplayBuffer


def test_random_vs_random_games_finish_deterministically() -> None:
    spec = random_agent()

    def play():
        return run_games(
            n_games=6,
            parallel=3,
            agent_for=lambda _i, _p: spec,
            seed=123,
            max_turns=600,
            collect_history=False,
        )

    first, second = play(), play()
    assert len(first) == 6
    for a, b in zip(first, second, strict=True):
        assert a.winner == b.winner and a.turns == b.turns
        assert a.winner in (0, 1, 2)
        assert 0 < a.turns <= 600


def test_heuristic_beats_random() -> None:
    result = play_match(
        heuristic_agent(),
        random_agent(),
        games=20,
        parallel=10,
        seed=99,
        max_turns=600,
    )
    assert result.games == 20
    assert result.score_a >= 0.7, result.summary("heuristic", "random")


def test_tiny_net_selfplay_fills_replay_buffer() -> None:
    torch.manual_seed(0)
    net = PolicyValueNet(NetConfig(blocks=1, channels=8))
    net.eval()
    evaluator = NetEvaluator(net, torch.device("cpu"))
    search = SearchConfig(
        max_children=8, m_root_cells=4, simulations=6, pass_simulations=1, root_noise=True
    )
    spec = net_agent("tiny", evaluator, search)
    finished = run_games(
        n_games=2,
        parallel=2,
        agent_for=lambda _i, _p: spec,
        seed=7,
        max_turns=80,
        collect_history=True,
    )
    assert len(finished) == 2
    buffer = ReplayBuffer(capacity=1000)
    for game in finished:
        assert game.history
        for record in game.history:
            assert record.policy is not None
            assert abs(float(record.policy.sum()) - 1.0) < 1e-4
        buffer.add_game(game.history, game.winner)
    assert buffer.size > 0

    planes, policy, value = buffer.sample(16, np.random.default_rng(1), lambda_mix=0.5)
    assert planes.shape == (16, 3, 15, 15)
    assert policy.shape == (16, 225)
    assert value.shape == (16,)
    assert np.all(value <= 1.0) and np.all(value >= -1.0)
    np.testing.assert_allclose(policy.sum(axis=1), 1.0, atol=1e-3)
