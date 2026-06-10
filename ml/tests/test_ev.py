"""EV-over-subsets rule: brute-force property tests."""

import itertools

import numpy as np
import pytest

from ungomoku_ml.mcts.ev import best_subset, ev_curve
from ungomoku_ml.rules import SUCCESS_PROBABILITY


def brute_force_best(qs: np.ndarray, q_pass: float) -> float:
    best = -np.inf
    for k in range(1, min(5, len(qs)) + 1):
        p = SUCCESS_PROBABILITY[k]
        for subset in itertools.combinations(range(len(qs)), k):
            ev = p * float(np.mean(qs[list(subset)])) + (1 - p) * q_pass
            best = max(best, ev)
    return best


@pytest.mark.parametrize("n_cells", range(1, 9))
@pytest.mark.parametrize("trial", range(20))
def test_best_subset_matches_brute_force(n_cells: int, trial: int) -> None:
    rng = np.random.default_rng(n_cells * 1000 + trial)
    qs = rng.uniform(-1, 1, size=n_cells)
    q_pass = float(rng.uniform(-1, 1))
    order, ev = best_subset(qs, q_pass)
    assert 1 <= len(order) <= 5
    # The chosen subset's EV must equal the brute-force optimum.
    assert ev == pytest.approx(brute_force_best(qs, q_pass), abs=1e-12)
    # And the subset must be a top-|S| prefix by q value.
    chosen = sorted(qs[order], reverse=True)
    top = sorted(np.sort(qs)[::-1][: len(order)], reverse=True)
    assert chosen == pytest.approx(top)


def test_ev_curve_matches_manual() -> None:
    qs = np.array([0.8, 0.2, -0.1])
    q_pass = -0.4
    evs = ev_curve(qs, q_pass)
    expected = [
        0.5 * 0.8 + 0.5 * -0.4,
        0.6 * 0.5 + 0.4 * -0.4,
        0.7 * (0.9 / 3) + 0.3 * -0.4,
    ]
    assert evs == pytest.approx(expected)


def test_two_immediate_wins_prefer_two_candidates() -> None:
    # One winning cell: k=1 gives 0.5 win; two winning cells: k=2 gives 0.6.
    one = best_subset(np.array([1.0, 0.0, 0.0]), q_pass=0.0)
    two = best_subset(np.array([1.0, 1.0, 0.0]), q_pass=0.0)
    assert len(one[0]) == 1
    assert len(two[0]) == 2
    assert two[1] > one[1]
