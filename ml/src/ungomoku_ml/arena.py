"""Agent-vs-agent evaluation with paired seat alternation."""

import math
from dataclasses import dataclass

from ungomoku_ml.agents import AgentSpec
from ungomoku_ml.driver import run_games
from ungomoku_ml.rules import PLAYER1


@dataclass
class MatchResult:
    wins_a: int
    wins_b: int
    draws: int

    @property
    def games(self) -> int:
        return self.wins_a + self.wins_b + self.draws

    @property
    def score_a(self) -> float:
        """Win rate for A, counting draws as half."""
        return (self.wins_a + 0.5 * self.draws) / max(1, self.games)

    def confidence95(self) -> float:
        """Half-width of a normal-approximation 95% CI on score_a."""
        n = max(1, self.games)
        p = self.score_a
        return 1.96 * math.sqrt(max(p * (1.0 - p), 1e-9) / n)

    def summary(self, name_a: str, name_b: str) -> str:
        return (
            f"{name_a} vs {name_b}: {self.wins_a}W {self.wins_b}L {self.draws}D "
            f"over {self.games} games -> score {self.score_a:.3f} "
            f"(+/- {self.confidence95():.3f})"
        )


def play_match(
    spec_a: AgentSpec,
    spec_b: AgentSpec,
    games: int,
    parallel: int,
    seed: int,
    max_turns: int,
) -> MatchResult:
    """A plays player1 in even-indexed games, player2 in odd-indexed games."""

    def agent_for(game_index: int, player: int) -> AgentSpec:
        a_is_p1 = game_index % 2 == 0
        return spec_a if (player == PLAYER1) == a_is_p1 else spec_b

    finished = run_games(
        n_games=games,
        parallel=parallel,
        agent_for=agent_for,
        seed=seed,
        max_turns=max_turns,
        collect_history=False,
    )

    result = MatchResult(0, 0, 0)
    for game in finished:
        if game.winner == 0:
            result.draws += 1
            continue
        a_is_p1 = game.index % 2 == 0
        if (game.winner == PLAYER1) == a_is_p1:
            result.wins_a += 1
        else:
            result.wins_b += 1
    return result
