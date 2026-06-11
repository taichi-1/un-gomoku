"""Concurrent game driver: advances per-game search generators in lockstep,
batching all pending net evaluations per evaluator each tick."""

from collections.abc import Callable, Generator
from dataclasses import dataclass, field

import numpy as np

from ungomoku_ml.agents import AgentSpec, cells_to_candidates
from ungomoku_ml.mcts.gumbel import MoveResult
from ungomoku_ml.rules import PLAYER1, new_board, other_player, resolve_turn

AgentFor = Callable[[int, int], AgentSpec]  # (game_index, player) -> spec


@dataclass
class PositionRecord:
    board: np.ndarray  # int8 copy taken before the move
    to_move: int
    policy: np.ndarray | None
    root_value: float


@dataclass
class FinishedGame:
    index: int
    winner: int  # 0 = draw or turn-cap
    turns: int
    history: list[PositionRecord] | None
    final_board: np.ndarray | None = None


@dataclass
class _Slot:
    index: int
    rng: np.random.Generator
    board: np.ndarray
    to_move: int = PLAYER1
    turns: int = 0
    history: list[PositionRecord] | None = None
    gen: Generator | None = None
    spec: AgentSpec | None = None
    inbox: tuple[np.ndarray, float] | None = None
    done: bool = False
    winner: int = 0
    pending: object = field(default=None)  # Node awaiting evaluation


def run_games(
    n_games: int,
    parallel: int,
    agent_for: AgentFor,
    seed: int,
    max_turns: int,
    collect_history: bool,
    on_game_done: Callable[[FinishedGame], None] | None = None,
) -> list[FinishedGame]:
    results: list[FinishedGame] = []
    next_index = 0

    def make_slot() -> _Slot:
        nonlocal next_index
        slot = _Slot(
            index=next_index,
            rng=np.random.default_rng(seed + next_index),
            board=new_board(),
            history=[] if collect_history else None,
        )
        next_index += 1
        return slot

    slots = [make_slot() for _ in range(min(parallel, n_games))]

    def apply_move(slot: _Slot, move: MoveResult) -> None:
        if slot.history is not None:
            slot.history.append(
                PositionRecord(
                    board=slot.board.copy(),
                    to_move=slot.to_move,
                    policy=move.policy_target,
                    root_value=move.root_value,
                )
            )
        outcome = resolve_turn(
            slot.board, slot.to_move, cells_to_candidates(move.cells), slot.rng.random
        )
        slot.turns += 1
        if outcome.game_over or slot.turns >= max_turns:
            slot.done = True
            slot.winner = outcome.winner
        else:
            slot.to_move = other_player(slot.to_move)

    while slots:
        # Phase 1: advance every slot until it needs a net eval or finishes its game.
        batches: dict[int, tuple[AgentSpec, list[_Slot]]] = {}
        for slot in slots:
            slot.pending = None
            while not slot.done and slot.pending is None:
                if slot.gen is None:
                    slot.spec = agent_for(slot.index, slot.to_move)
                    produced = slot.spec.move(slot.board, slot.to_move, slot.rng)
                    if isinstance(produced, MoveResult):
                        apply_move(slot, produced)
                        continue
                    slot.gen = produced
                    slot.inbox = None
                try:
                    slot.pending = slot.gen.send(slot.inbox)
                    slot.inbox = None
                except StopIteration as stop:
                    slot.gen = None
                    apply_move(slot, stop.value)
            if slot.pending is not None:
                assert slot.spec is not None and slot.spec.evaluator is not None
                key = id(slot.spec.evaluator)
                batches.setdefault(key, (slot.spec, []))[1].append(slot)

        # Phase 2: batched evaluation per evaluator.
        for spec, waiting in batches.values():
            assert spec.evaluator is not None
            logits, values = spec.evaluator([slot.pending for slot in waiting])
            for row, slot in enumerate(waiting):
                slot.inbox = (logits[row], float(values[row]))

        # Phase 3: recycle finished slots.
        alive: list[_Slot] = []
        for slot in slots:
            if not slot.done:
                alive.append(slot)
                continue
            finished = FinishedGame(
                index=slot.index,
                winner=slot.winner,
                turns=slot.turns,
                history=slot.history,
                final_board=slot.board.copy() if collect_history else None,
            )
            results.append(finished)
            if on_game_done is not None:
                on_game_done(finished)
            if next_index < n_games:
                alive.append(make_slot())
        slots = alive

    results.sort(key=lambda g: g.index)
    return results


def drive_single(gen: Generator, evaluator) -> MoveResult:
    """Advances one search generator to completion (tests / debugging)."""
    try:
        request = gen.send(None)
        while True:
            logits, values = evaluator([request])
            request = gen.send((logits[0], float(values[0])))
    except StopIteration as stop:
        return stop.value
