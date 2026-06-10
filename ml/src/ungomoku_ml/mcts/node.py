"""Tree nodes for the chance-aware search.

A decision node is (board, to_move). Its children are:
- one node per candidate cell c (board + mover's stone at c, opponent to move)
- one "pass" child (same board, opponent to move) — the failed-turn outcome

Node values are always from the node's player-to-move perspective. A node's
value is the EV-maximum over subset sizes (see mcts/ev.py) computed from its
children's current values, so backups propagate the exact chance structure
instead of plain visit means. The pass-pass cycle (identical state two plies
down) is safe in a tree: nodes are distinct objects and recursion is bounded
by how deep simulations actually went.
"""

import numpy as np

from ungomoku_ml.encoding import cell_xy, legal_mask
from ungomoku_ml.mcts.ev import ev_curve
from ungomoku_ml.rules import (
    MAX_CANDIDATES,
    other_player,
)
from ungomoku_ml.rules.win import check_win_at, is_board_full

PASS = -1

# kstar fallback before any children are evaluated (p = 0.7).
DEFAULT_KSTAR = 3


class Node:
    __slots__ = (
        "board",
        "cells",
        "child_n",
        "children",
        "expanded",
        "kstar",
        "logits",
        "n_total",
        "pass_child",
        "pass_n",
        "priors",
        "terminal_value",
        "to_move",
        "v_net",
        "value",
    )

    def __init__(self, board: np.ndarray, to_move: int, terminal_value: float | None = None):
        self.board = board  # never mutated after construction; children copy
        self.to_move = to_move
        self.terminal_value = terminal_value
        self.expanded = False
        self.v_net = 0.0
        self.value = terminal_value if terminal_value is not None else 0.0
        self.logits: np.ndarray | None = None
        self.cells: np.ndarray | None = None
        self.priors: np.ndarray | None = None
        self.child_n: np.ndarray | None = None
        self.children: list[Node | None] | None = None
        self.pass_child: Node | None = None
        self.pass_n = 0
        self.n_total = 0
        self.kstar = DEFAULT_KSTAR

    @property
    def is_terminal(self) -> bool:
        return self.terminal_value is not None


def expand(node: Node, logits: np.ndarray, value: float, max_children: int) -> None:
    """Attaches net output to an unexpanded, non-terminal node."""
    mask = legal_mask(node.board)
    legal = np.flatnonzero(mask)
    if len(legal) == 0:
        raise RuntimeError("expand called on a full board; should be terminal")
    legal_logits = logits[legal]
    if len(legal) > max_children:
        top = np.argpartition(-legal_logits, max_children - 1)[:max_children]
        # Stable order: keep cells sorted by logit descending for reproducibility.
        top = top[np.argsort(-legal_logits[top], kind="stable")]
        cells = legal[top]
    else:
        cells = legal[np.argsort(-legal_logits, kind="stable")]
    selected = logits[cells]
    shifted = np.exp(selected - selected.max())
    node.priors = shifted / shifted.sum()
    node.cells = cells
    node.logits = logits
    node.children = [None] * len(cells)
    node.child_n = np.zeros(len(cells), dtype=np.int32)
    node.v_net = float(value)
    node.value = float(value)
    node.kstar = min(DEFAULT_KSTAR, len(cells))
    node.expanded = True


def ensure_cell_child(node: Node, index: int) -> "Node":
    assert node.children is not None and node.cells is not None
    child = node.children[index]
    if child is not None:
        return child
    cell = int(node.cells[index])
    x, y = cell_xy(cell)
    board = node.board.copy()
    board[y, x] = node.to_move
    opponent = other_player(node.to_move)
    if check_win_at(board, x, y, node.to_move):
        child = Node(board, opponent, terminal_value=-1.0)
    elif is_board_full(board):
        child = Node(board, opponent, terminal_value=0.0)
    else:
        child = Node(board, opponent)
    node.children[index] = child
    return child


def ensure_pass_child(node: Node) -> "Node":
    if node.pass_child is None:
        # Board is shared (a failed turn changes nothing); boards are immutable.
        node.pass_child = Node(node.board, other_player(node.to_move))
    return node.pass_child


def child_q(node: Node, index: int) -> float | None:
    """Q of cell child from ``node``'s perspective, None if not yet informative."""
    assert node.children is not None
    child = node.children[index]
    if child is None or (not child.expanded and not child.is_terminal):
        return None
    return -child.value


def pass_q(node: Node) -> float:
    """Q of the failed-turn outcome from ``node``'s perspective.

    Falls back to the static eval (ignoring the tempo loss) until the pass
    child has been evaluated.
    """
    child = node.pass_child
    if child is not None and (child.expanded or child.is_terminal):
        return -child.value
    return node.v_net


def recompute(node: Node) -> None:
    """Refreshes node.value and node.kstar from current child values."""
    assert node.cells is not None
    qs = [q for i in range(len(node.cells)) if (q := child_q(node, i)) is not None]
    if not qs:
        node.value = node.v_net
        node.kstar = min(DEFAULT_KSTAR, len(node.cells))
        return
    q_sorted = np.sort(np.asarray(qs, dtype=np.float64))[::-1]
    evs = ev_curve(q_sorted, pass_q(node), MAX_CANDIDATES)
    best = int(np.argmax(evs))
    node.value = float(evs[best])
    node.kstar = best + 1


def select_cell(node: Node, c_puct: float) -> int:
    """PUCT over cell children. FPU = current node value."""
    assert node.cells is not None and node.priors is not None and node.child_n is not None
    q = np.full(len(node.cells), node.value, dtype=np.float64)
    for i in range(len(node.cells)):
        known = child_q(node, i)
        if known is not None:
            q[i] = known
    u = c_puct * node.priors * (np.sqrt(node.n_total + 1.0) / (1.0 + node.child_n))
    return int(np.argmax(q + u))
