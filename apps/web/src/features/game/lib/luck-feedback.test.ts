import { describe, expect, test } from "bun:test";
import type { TurnResultDTO } from "@pkg/shared/schemas";
import {
  calculateLuckFeedback,
  resolveLuckLabelKeyFromZScore,
} from "./luck-feedback";

function createCandidates(count: number): TurnResultDTO["candidates"] {
  return Array.from({ length: count }, (_, index) => ({
    x: index,
    y: index,
  }));
}

function createTurn(
  player: TurnResultDTO["player"],
  candidateCount: number,
  success: boolean,
): TurnResultDTO {
  return {
    success,
    placedPosition: success ? { x: 0, y: 0 } : null,
    candidates: createCandidates(candidateCount),
    player,
    gameOver: false,
    winner: null,
  };
}

describe("luck-feedback", () => {
  test("calculates expected success, luck delta, and success stats", () => {
    const feedback = calculateLuckFeedback([
      createTurn("player1", 1, true),
      createTurn("player1", 5, false),
      createTurn("player2", 2, false),
      createTurn("player2", 3, true),
    ]);

    expect(feedback.player1.totalTurns).toBe(2);
    expect(feedback.player1.successCount).toBe(1);
    expect(feedback.player1.expectedSuccess).toBeCloseTo(1.4, 8);
    expect(feedback.player1.luckDelta).toBeCloseTo(-0.4, 8);
    expect(feedback.player1.luckDeltaRate).toBeCloseTo(-20, 8);
    expect(feedback.player1.successRate).toBeCloseTo(0.5, 8);
    expect(feedback.player1.luckLabelKey).toBe("unlucky");

    expect(feedback.player2.totalTurns).toBe(2);
    expect(feedback.player2.successCount).toBe(1);
    expect(feedback.player2.expectedSuccess).toBeCloseTo(1.3, 8);
    expect(feedback.player2.luckDelta).toBeCloseTo(-0.3, 8);
    expect(feedback.player2.luckDeltaRate).toBeCloseTo(-15, 8);
    expect(feedback.player2.successRate).toBeCloseTo(0.5, 8);
    expect(feedback.player2.luckLabelKey).toBe("unlucky");
  });

  test("returns safe defaults for empty history", () => {
    const feedback = calculateLuckFeedback([]);

    expect(feedback.player1).toEqual({
      totalTurns: 0,
      successCount: 0,
      expectedSuccess: 0,
      luckDelta: 0,
      luckDeltaRate: 0,
      successRate: 0,
      luckLabelKey: "expected",
    });

    expect(feedback.player2).toEqual({
      totalTurns: 0,
      successCount: 0,
      expectedSuccess: 0,
      luckDelta: 0,
      luckDeltaRate: 0,
      successRate: 0,
      luckLabelKey: "expected",
    });
  });

  test("classifies luck labels at z-score boundaries", () => {
    expect(resolveLuckLabelKeyFromZScore(1.2)).toBe("veryLucky");
    expect(resolveLuckLabelKeyFromZScore(1.199)).toBe("lucky");
    expect(resolveLuckLabelKeyFromZScore(0.4)).toBe("lucky");
    expect(resolveLuckLabelKeyFromZScore(0.399)).toBe("expected");
    expect(resolveLuckLabelKeyFromZScore(-0.399)).toBe("expected");
    expect(resolveLuckLabelKeyFromZScore(-0.4)).toBe("unlucky");
    expect(resolveLuckLabelKeyFromZScore(-1.199)).toBe("unlucky");
    expect(resolveLuckLabelKeyFromZScore(-1.2)).toBe("veryUnlucky");
  });
});
