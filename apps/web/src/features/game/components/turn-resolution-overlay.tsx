import { BOARD_SIZE } from "@pkg/shared/constants";
import type { PlayerId } from "@pkg/shared/schemas";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { NumberedStoneIcon } from "@/features/game/components/stone-icon";
import {
  createTurnResolutionDisplaySpec,
  schedulePhaseCompletionTimer,
  type TurnResolutionDisplaySpec,
} from "@/features/game/lib/turn-resolution-display-spec";
import {
  createTurnResolutionEmphasisSchedule,
  type TurnResolutionEmphasisStep,
} from "@/features/game/lib/turn-resolution-emphasis-schedule";
import type {
  ActiveTurnResolutionFx,
  TurnResolutionFxPhase,
} from "@/features/game/lib/turn-resolution-fx-controller";
import {
  getFinalOverlayCandidates,
  getPlacedCandidateIndex,
  getSequenceOverlayCandidates,
} from "@/features/game/lib/turn-resolution-overlay";
import { playBlink, playResult } from "@/features/game/sound/game-sound-player";

interface TurnResolutionOverlayProps {
  activeFx: ActiveTurnResolutionFx | null;
  phase: TurnResolutionFxPhase;
  onPhaseComplete: (phase: Exclude<TurnResolutionFxPhase, "idle">) => void;
  reducedMotionOverride?: boolean;
  blackPlayer?: PlayerId;
}

interface SequenceLayerProps {
  activeFx: ActiveTurnResolutionFx;
  spec: TurnResolutionDisplaySpec;
  activeStep: TurnResolutionEmphasisStep | null;
}

interface FinalLayerProps {
  activeFx: ActiveTurnResolutionFx;
  spec: TurnResolutionDisplaySpec;
  reducedMotion: boolean;
  blackPlayer: PlayerId;
}

const GRID_STYLE = {
  gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
  padding: "calc(var(--board-size) / 32)",
} as const;

function clearTimeoutSafe(timeoutId: ReturnType<typeof globalThis.setTimeout>) {
  globalThis.clearTimeout(
    timeoutId as Parameters<typeof globalThis.clearTimeout>[0],
  );
}

function SequenceLayer({ activeFx, spec, activeStep }: SequenceLayerProps) {
  const sequenceCandidates = getSequenceOverlayCandidates(activeFx);
  const activeCandidateIndex = activeStep?.candidateIndex ?? 0;
  const hasActiveCandidate = activeStep?.isActive ?? false;
  const emphasisDurationSec = Math.max(
    0.06,
    ((activeStep?.durationMs ?? 120) * 0.55) / 1000,
  );

  return (
    <motion.div
      key={`fx-seq-${activeFx.id}`}
      className="grid h-full w-full"
      style={GRID_STYLE}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: spec.phaseFadeMs } }}
    >
      {sequenceCandidates.map((candidate, index) => {
        const isActive = hasActiveCandidate && index === activeCandidateIndex;

        return (
          <motion.div
            key={`seq-${candidate.coord.x}:${candidate.coord.y}`}
            className="relative flex items-center justify-center"
            style={{
              gridColumnStart: candidate.coord.x + 1,
              gridRowStart: candidate.coord.y + 1,
            }}
            initial={false}
            animate={{
              opacity: isActive ? spec.activeOpacity : spec.inactiveOpacity,
              scale: isActive ? spec.activeScale : spec.inactiveScale,
            }}
            transition={{
              duration: emphasisDurationSec,
              ease: isActive ? [0.18, 0.84, 0.22, 1] : "linear",
            }}
          >
            <motion.div
              className="absolute inset-[14%] rounded-full border-2"
              initial={false}
              animate={{
                opacity: isActive ? 1 : 0.25,
                scale: isActive ? spec.focusRingScale : 1,
                borderColor: isActive
                  ? "rgba(208,161,90,0.96)"
                  : "rgba(208,161,90,0.26)",
                boxShadow: isActive
                  ? "0 0 12px 2px rgba(208,161,90,0.56)"
                  : "0 0 0 rgba(0,0,0,0)",
              }}
              transition={{
                duration: emphasisDurationSec,
                ease: isActive ? [0.18, 0.84, 0.22, 1] : "linear",
              }}
            />
            <NumberedStoneIcon
              playerId={activeFx.result.player}
              number={candidate.rank}
              className="pointer-events-none"
              stoneClassName={
                isActive
                  ? "drop-shadow-[0_0_10px_rgba(208,161,90,0.82)]"
                  : "drop-shadow-[0_0_2px_rgba(26,22,17,0.35)]"
              }
              numberStyle={{ fontSize: "calc(var(--board-size) / 46)" }}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function FinalLayer({
  activeFx,
  spec,
  reducedMotion,
  blackPlayer,
}: FinalLayerProps) {
  const finalCandidates = getFinalOverlayCandidates(activeFx);
  const isBlackPlayerResult = activeFx.result.player === blackPlayer;
  const failHaloGradient = isBlackPlayerResult
    ? "radial-gradient(circle at center, rgba(82,94,113,0.3) 0%, rgba(82,94,113,0.14) 60%, rgba(82,94,113,0) 100%)"
    : "radial-gradient(circle at center, rgba(94,104,119,0.22) 0%, rgba(94,104,119,0.08) 60%, rgba(94,104,119,0) 100%)";
  const failRingClass = isBlackPlayerResult
    ? "absolute inset-[16%] rounded-full border-2 border-[rgba(138,152,173,0.98)] shadow-[0_0_0_1px_rgba(41,48,60,0.65)]"
    : "absolute inset-[16%] rounded-full border-2 border-[rgba(170,182,200,0.88)]";
  const failMarkClass = isBlackPlayerResult
    ? "absolute select-none text-[calc(var(--board-size)/34)] font-semibold leading-none text-[rgba(12,10,8,0.95)]"
    : "absolute select-none text-[calc(var(--board-size)/34)] font-semibold leading-none text-[rgba(228,235,245,0.96)]";

  return (
    <motion.div
      key={`fx-final-${activeFx.id}`}
      className="relative grid h-full w-full"
      style={GRID_STYLE}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: spec.phaseFadeMs }}
    >
      {!activeFx.result.success ? (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.72 }}
          exit={{ opacity: 0 }}
          transition={{ duration: spec.phaseFadeMs }}
          style={{
            background:
              "radial-gradient(circle at center, rgba(94,104,119,0.14) 0%, rgba(94,104,119,0.06) 48%, rgba(94,104,119,0) 100%)",
          }}
        />
      ) : null}

      {activeFx.result.success
        ? finalCandidates.map((candidate) => (
            <motion.div
              key={`final-success-${candidate.coord.x}:${candidate.coord.y}`}
              className="relative z-10 flex items-center justify-center"
              style={{
                gridColumnStart: candidate.coord.x + 1,
                gridRowStart: candidate.coord.y + 1,
              }}
              initial={{ scale: 0.96, opacity: 0.88 }}
              animate={{ scale: 1.04, opacity: 1 }}
              transition={{
                duration: spec.finalEntryMs / 1000,
                ease: reducedMotion ? "linear" : [0.24, 0.84, 0.24, 1],
              }}
            >
              <div className="absolute inset-[14%] rounded-full border-2 border-[rgba(235,206,157,0.9)]" />
              <NumberedStoneIcon
                playerId={activeFx.result.player}
                number={candidate.rank}
                className="pointer-events-none"
                stoneClassName="drop-shadow-[0_0_8px_rgba(208,161,90,0.68)]"
                numberStyle={{ fontSize: "calc(var(--board-size) / 46)" }}
              />
            </motion.div>
          ))
        : finalCandidates.map((candidate) => (
            <motion.div
              key={`final-fail-${candidate.coord.x}:${candidate.coord.y}`}
              className="relative z-10 flex items-center justify-center"
              style={{
                gridColumnStart: candidate.coord.x + 1,
                gridRowStart: candidate.coord.y + 1,
              }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: spec.finalEntryMs / 1000,
                ease: reducedMotion ? "linear" : [0.2, 0.82, 0.2, 1],
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: failHaloGradient,
                }}
              />
              <div className={failRingClass} />
              <span className={failMarkClass}>×</span>
            </motion.div>
          ))}
    </motion.div>
  );
}

export function TurnResolutionOverlay({
  activeFx,
  phase,
  onPhaseComplete,
  reducedMotionOverride,
  blackPlayer = "player1",
}: TurnResolutionOverlayProps) {
  const reducedMotionFromOS = useReducedMotion();
  const reducedMotion = reducedMotionOverride ?? reducedMotionFromOS ?? false;
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const displaySpec = useMemo(() => {
    if (!activeFx) {
      return null;
    }

    return createTurnResolutionDisplaySpec({
      timeline: activeFx.timeline,
      candidateCount: activeFx.result.candidates.length,
      reducedMotion,
    });
  }, [activeFx, reducedMotion]);

  const sequenceSchedule = useMemo(() => {
    if (!activeFx || !displaySpec) {
      return null;
    }

    return createTurnResolutionEmphasisSchedule({
      candidateCount: activeFx.result.candidates.length,
      lapCount: displaySpec.lapCount,
      sequenceMs: displaySpec.sequenceMs,
      stopBeats: "last_two_long",
      stopCandidateIndex: getPlacedCandidateIndex(activeFx),
    });
  }, [activeFx, displaySpec]);

  useEffect(() => {
    if (
      !activeFx ||
      !displaySpec ||
      !sequenceSchedule ||
      phase !== "sequence" ||
      sequenceSchedule.steps.length === 0
    ) {
      return;
    }

    setActiveStepIndex(0);
    const timerIds: ReturnType<typeof globalThis.setTimeout>[] = [];

    for (const step of sequenceSchedule.steps) {
      const stepPlayKey = `${activeFx.id}:${step.stepIndex}`;
      const timeoutId = globalThis.setTimeout(() => {
        setActiveStepIndex(step.stepIndex);
        if (!step.isActive) {
          return;
        }
        playBlink(stepPlayKey);
      }, Math.round(step.startMs));
      timerIds.push(timeoutId);
    }

    const cleanupCompletion = schedulePhaseCompletionTimer({
      phase: "sequence",
      durationMs: sequenceSchedule.totalDurationMs,
      onPhaseComplete,
    });

    return () => {
      cleanupCompletion();
      for (const timeoutId of timerIds) {
        clearTimeoutSafe(timeoutId);
      }
    };
  }, [activeFx, displaySpec, onPhaseComplete, phase, sequenceSchedule]);

  useEffect(() => {
    if (!activeFx || !displaySpec || phase !== "final") {
      return;
    }

    const resultPlayKey = `${activeFx.id}`;
    playResult(activeFx.result.success, resultPlayKey);

    return schedulePhaseCompletionTimer({
      phase: "final",
      durationMs: displaySpec.finalMs,
      onPhaseComplete,
    });
  }, [activeFx, displaySpec, onPhaseComplete, phase]);

  const activeStep = useMemo(() => {
    if (!sequenceSchedule || sequenceSchedule.steps.length === 0) {
      return null;
    }

    const boundedStepIndex = Math.min(
      Math.max(activeStepIndex, 0),
      sequenceSchedule.steps.length - 1,
    );
    return sequenceSchedule.steps[boundedStepIndex] ?? null;
  }, [activeStepIndex, sequenceSchedule]);

  if (!activeFx || !displaySpec || phase === "idle") {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "sequence" ? (
          <SequenceLayer
            activeFx={activeFx}
            spec={displaySpec}
            activeStep={activeStep}
          />
        ) : null}
        {phase === "final" ? (
          <FinalLayer
            activeFx={activeFx}
            reducedMotion={reducedMotion}
            spec={displaySpec}
            blackPlayer={blackPlayer}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
