import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import {
  createTurnResolutionDisplaySpec,
  schedulePhaseCompletionTimer,
} from "./turn-resolution-display-spec";

describe("turn-resolution-display-spec", () => {
  test("uses fixed normal timing window and coherent step count", () => {
    const spec = createTurnResolutionDisplaySpec({
      timeline: {
        totalMs: 1500,
        sequenceMs: 1080,
        finalMs: 420,
        stepMs: 216,
      },
      candidateCount: 5,
      reducedMotion: false,
    });

    expect(spec.totalMs).toBe(1450);
    expect(spec.sequenceMs).toBe(1170);
    expect(spec.finalMs).toBe(280);
    expect(spec.sequenceMs + spec.finalMs).toBe(spec.totalMs);
    expect(spec.lapCount).toBeGreaterThanOrEqual(2);
    expect(spec.lapCount).toBeLessThanOrEqual(5);
    expect(spec.totalSteps).toBe(5 * spec.lapCount);
    expect(spec.activeOpacity).toBe(1);
    expect(spec.inactiveOpacity).toBeLessThan(spec.activeOpacity);
  });

  test("uses reduced-motion timing and single lap", () => {
    const spec = createTurnResolutionDisplaySpec({
      timeline: {
        totalMs: 1000,
        sequenceMs: 720,
        finalMs: 280,
        stepMs: 240,
      },
      candidateCount: 3,
      reducedMotion: true,
    });

    expect(spec.totalMs).toBe(1000);
    expect(spec.sequenceMs).toBe(760);
    expect(spec.finalMs).toBe(240);
    expect(spec.sequenceMs + spec.finalMs).toBe(spec.totalMs);
    expect(spec.lapCount).toBe(1);
    expect(spec.totalSteps).toBe(3);
    expect(spec.activeScale).toBeGreaterThan(spec.inactiveScale);
  });

  test("keeps totalSteps valid for candidate count 1..5", () => {
    for (let candidateCount = 1; candidateCount <= 5; candidateCount += 1) {
      const spec = createTurnResolutionDisplaySpec({
        timeline: {
          totalMs: 1200,
          sequenceMs: 864,
          finalMs: 336,
          stepMs: 172.8,
        },
        candidateCount,
        reducedMotion: false,
      });

      expect(spec.totalSteps).toBe(candidateCount * spec.lapCount);
      expect(spec.lapCount).toBeGreaterThanOrEqual(2);
      expect(spec.lapCount).toBeLessThanOrEqual(5);
    }
  });
});

describe("overlay phase completion timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("fires sequence completion exactly once", () => {
    const onPhaseComplete = vi.fn();

    schedulePhaseCompletionTimer({
      phase: "sequence",
      durationMs: 120,
      onPhaseComplete,
    });

    vi.advanceTimersByTime(119);
    expect(onPhaseComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onPhaseComplete).toHaveBeenCalledTimes(1);
    expect(onPhaseComplete).toHaveBeenCalledWith("sequence");

    vi.advanceTimersByTime(500);
    expect(onPhaseComplete).toHaveBeenCalledTimes(1);
  });

  test("fires final completion exactly once", () => {
    const onPhaseComplete = vi.fn();

    schedulePhaseCompletionTimer({
      phase: "final",
      durationMs: 80,
      onPhaseComplete,
    });

    vi.advanceTimersByTime(80);
    expect(onPhaseComplete).toHaveBeenCalledTimes(1);
    expect(onPhaseComplete).toHaveBeenCalledWith("final");

    vi.advanceTimersByTime(300);
    expect(onPhaseComplete).toHaveBeenCalledTimes(1);
  });

  test("cleanup prevents callback after unmount", () => {
    const onPhaseComplete = vi.fn();

    const cleanup = schedulePhaseCompletionTimer({
      phase: "sequence",
      durationMs: 140,
      onPhaseComplete,
    });

    cleanup();
    vi.advanceTimersByTime(500);

    expect(onPhaseComplete).not.toHaveBeenCalled();
  });
});
