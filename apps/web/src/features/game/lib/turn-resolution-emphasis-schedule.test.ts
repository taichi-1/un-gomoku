import { describe, expect, test } from "bun:test";
import { createTurnResolutionEmphasisSchedule } from "./turn-resolution-emphasis-schedule";

describe("turn-resolution-emphasis-schedule", () => {
  test("keeps strict candidate order across laps", () => {
    const schedule = createTurnResolutionEmphasisSchedule({
      candidateCount: 5,
      lapCount: 3,
      sequenceMs: 1170,
    });

    expect(schedule.totalSteps).toBe(15);
    expect(schedule.totalDurationMs).toBeCloseTo(1170, 6);
    expect(schedule.steps.map((step) => step.rank)).toEqual([
      1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5,
    ]);
  });

  test("normalizes durations to sequenceMs", () => {
    const sequenceMs = 1170;
    const schedule = createTurnResolutionEmphasisSchedule({
      candidateCount: 4,
      lapCount: 2,
      sequenceMs,
    });

    const durationSum = schedule.steps.reduce(
      (sum, step) => sum + step.durationMs,
      0,
    );
    const firstStart = schedule.steps[0]?.startMs ?? 0;
    const lastEnd = schedule.steps.at(-1)?.endMs ?? 0;

    expect(durationSum).toBeCloseTo(schedule.totalDurationMs, 6);
    expect(firstStart).toBe(0);
    expect(lastEnd).toBeCloseTo(schedule.totalDurationMs, 6);
  });

  test("supports uniform pacing when stop beats are disabled", () => {
    const schedule = createTurnResolutionEmphasisSchedule({
      candidateCount: 5,
      lapCount: 2,
      sequenceMs: 1170,
      stopBeats: "none",
    });

    const first = schedule.steps[0]?.durationMs ?? 0;
    const middle = schedule.steps[4]?.durationMs ?? 0;
    const last = schedule.steps.at(-1)?.durationMs ?? 0;

    expect(middle).toBeCloseTo(first, 6);
    expect(last).toBeCloseTo(first, 6);
  });

  test("keeps last two steps longer when stop beats are enabled", () => {
    const schedule = createTurnResolutionEmphasisSchedule({
      candidateCount: 5,
      lapCount: 2,
      sequenceMs: 1170,
      stopBeats: "last_two_long",
    });

    const preLast = schedule.steps.at(-2)?.durationMs ?? 0;
    const last = schedule.steps.at(-1)?.durationMs ?? 0;
    const previous = schedule.steps.at(-3)?.durationMs ?? 0;

    expect(preLast).toBeGreaterThan(previous);
    expect(last).toBeGreaterThan(preLast);
  });

  test("supports reduced-style single lap scheduling", () => {
    const schedule = createTurnResolutionEmphasisSchedule({
      candidateCount: 3,
      lapCount: 1,
      sequenceMs: 760,
    });

    expect(schedule.totalSteps).toBe(3);
    expect(schedule.steps.map((step) => step.rank)).toEqual([1, 2, 3]);
    expect(schedule.steps.every((step) => step.lap === 1)).toBe(true);
    expect(schedule.steps.every((step) => step.isActive)).toBe(true);
  });

  test("alternates active/inactive when there is only one candidate", () => {
    const schedule = createTurnResolutionEmphasisSchedule({
      candidateCount: 1,
      lapCount: 5,
      sequenceMs: 1170,
      stopBeats: "none",
    });

    expect(schedule.totalSteps).toBe(5);
    expect(schedule.steps.map((step) => step.candidateIndex)).toEqual([
      0, 0, 0, 0, 0,
    ]);
    expect(schedule.steps.map((step) => step.isActive)).toEqual([
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  test("extends steps to stop on requested candidate index", () => {
    const schedule = createTurnResolutionEmphasisSchedule({
      candidateCount: 5,
      lapCount: 2,
      sequenceMs: 1170,
      stopBeats: "none",
      stopCandidateIndex: 2,
    });

    expect(schedule.totalSteps).toBe(13);
    expect(schedule.steps.at(-1)?.candidateIndex).toBe(2);
    expect(schedule.totalDurationMs).toBeCloseTo((1170 / 10) * 13, 6);
  });
});
