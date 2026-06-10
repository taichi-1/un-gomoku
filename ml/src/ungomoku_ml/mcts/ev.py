"""Expected-value rule over candidate subsets.

For a subset S of k cells with per-cell values Q(c) and failure value Q_pass:

    EV(S) = p(k) * mean_{c in S} Q(c) + (1 - p(k)) * Q_pass

Because the placed cell is uniform over S, for a fixed k the optimal subset is
exactly the k cells with the highest Q. Choosing a move therefore reduces to
comparing the EVs of the top-k prefixes for k = 1..5.

Mirrored line-for-line by the TS engine (apps/web .../lib/ai/ev.ts).
"""

import numpy as np

from ungomoku_ml.rules import MAX_CANDIDATES, SUCCESS_PROBABILITY

_PROBS = np.array([SUCCESS_PROBABILITY[k] for k in range(1, MAX_CANDIDATES + 1)])


def ev_curve(q_sorted_desc: np.ndarray, q_pass: float, max_k: int = MAX_CANDIDATES) -> np.ndarray:
    """EV of the top-k prefix for k = 1..min(max_k, len(q)).

    ``q_sorted_desc`` must be sorted in descending order.
    """
    limit = min(max_k, len(q_sorted_desc), MAX_CANDIDATES)
    if limit == 0:
        return np.empty(0, dtype=np.float64)
    prefix = q_sorted_desc[:limit]
    means = np.cumsum(prefix) / np.arange(1, limit + 1)
    probs = _PROBS[:limit]
    return probs * means + (1.0 - probs) * q_pass


def best_subset(
    q_values: np.ndarray,
    q_pass: float,
    max_k: int = MAX_CANDIDATES,
) -> tuple[np.ndarray, float]:
    """Returns (indices into q_values ordered best-first, EV) of the optimal subset."""
    order = np.argsort(-q_values, kind="stable")
    evs = ev_curve(q_values[order], q_pass, max_k)
    if len(evs) == 0:
        raise ValueError("best_subset needs at least one q value")
    k = int(np.argmax(evs)) + 1
    return order[:k], float(evs[k - 1])
