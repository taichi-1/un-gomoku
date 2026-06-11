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

    planes, policy, value, ownership = buffer.sample(16, np.random.default_rng(1), lambda_mix=0.5)
    assert planes.shape == (16, 3, 15, 15)
    assert policy.shape == (16, 225)
    assert value.shape == (16,)
    assert ownership is None  # store_ownership not enabled
    assert np.all(value <= 1.0) and np.all(value >= -1.0)
    np.testing.assert_allclose(policy.sum(axis=1), 1.0, atol=1e-3)


def test_ownership_targets_are_mover_relative_and_augmented() -> None:
    from ungomoku_ml.driver import PositionRecord
    from ungomoku_ml.rules import BOARD_SIZE, new_board

    buffer = ReplayBuffer(capacity=64, in_planes=5, store_ownership=True)
    board = new_board()
    final = new_board()
    final[7, 3] = 1
    final[0, 14] = 2
    record_p1 = PositionRecord(
        board=board.copy(), to_move=1, policy=np.full(225, 1 / 225, np.float32), root_value=0.0
    )
    record_p2 = PositionRecord(
        board=board.copy(), to_move=2, policy=np.full(225, 1 / 225, np.float32), root_value=0.0
    )
    buffer.add_game([record_p1, record_p2], winner=1, final_board=final)

    rng = np.random.default_rng(0)
    found = {1: False, 2: False}
    for _ in range(20):
        _planes, _policy, _value, ownership = buffer.sample(8, rng, lambda_mix=0.5)
        assert ownership is not None and ownership.shape == (8, BOARD_SIZE, BOARD_SIZE)
        for row in range(8):
            counts = np.bincount(ownership[row].reshape(-1), minlength=3)
            # Exactly two stones on the final board: one mover-class, one
            # opponent-class regardless of perspective or symmetry.
            assert counts[1] == 1 and counts[2] == 1
            found[1] = True
            found[2] = True
    assert all(found.values())
