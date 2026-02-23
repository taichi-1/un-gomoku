import type {
  HowlerGlobal as HowlerGlobalType,
  Howl as HowlType,
} from "howler";
import {
  type CandidateCount,
  type GameSoundClipConfig,
  type GameSoundId,
  gameSoundConfig,
  isCandidateCount,
} from "@/features/game/sound/game-sound-config";

interface HowlConstructor {
  new (options: {
    src: string[];
    volume: number;
    rate: number;
    preload: boolean;
    html5?: boolean;
  }): HowlType;
}

interface LoadedHowlerModule {
  Howl: HowlConstructor | null;
  Howler: HowlerGlobalType | null;
}

const howlBySoundId = new Map<GameSoundId, HowlType>();
const pendingHowlBySoundId = new Map<GameSoundId, Promise<HowlType | null>>();
const playedBlinkTimestamps = new Map<string, number>();
const playedResultTimestamps = new Map<string, number>();
const playedGameEndTimestamps = new Map<string, number>();

let howlerModulePromise: Promise<LoadedHowlerModule> | null = null;
let isGameSoundMuted = false;
const EFFECT_DEDUPE_WINDOW_MS = 1600;
const MAX_EFFECT_DEDUPE_KEYS = 2048;

function canUseAudioRuntime(): boolean {
  return typeof window !== "undefined";
}

async function loadHowlerModule(): Promise<LoadedHowlerModule> {
  if (!canUseAudioRuntime()) {
    return {
      Howl: null,
      Howler: null,
    };
  }

  if (howlerModulePromise) {
    return howlerModulePromise;
  }

  howlerModulePromise = import("howler")
    .then((module) => ({
      Howl: module.Howl as HowlConstructor,
      Howler: module.Howler ?? null,
    }))
    .catch(() => ({
      Howl: null,
      Howler: null,
    }));

  return howlerModulePromise;
}

async function loadHowlConstructor(): Promise<HowlConstructor | null> {
  const module = await loadHowlerModule();
  return module.Howl;
}

async function loadHowlerGlobal(): Promise<HowlerGlobalType | null> {
  const module = await loadHowlerModule();
  return module.Howler;
}

function claimEffectPlayOnce(
  playedAtByKey: Map<string, number>,
  playKey: string | null | undefined,
  nowMs: number,
  dedupeWindowMs = EFFECT_DEDUPE_WINDOW_MS,
): boolean {
  if (!playKey) {
    return true;
  }

  const playedAt = playedAtByKey.get(playKey);
  if (
    typeof playedAt === "number" &&
    nowMs - playedAt >= 0 &&
    nowMs - playedAt < dedupeWindowMs
  ) {
    return false;
  }

  playedAtByKey.set(playKey, nowMs);

  if (playedAtByKey.size > MAX_EFFECT_DEDUPE_KEYS) {
    for (const [key, value] of playedAtByKey.entries()) {
      if (nowMs - value > dedupeWindowMs) {
        playedAtByKey.delete(key);
      }
    }

    if (playedAtByKey.size > MAX_EFFECT_DEDUPE_KEYS) {
      playedAtByKey.clear();
      playedAtByKey.set(playKey, nowMs);
    }
  }

  return true;
}

function createHowl(soundId: GameSoundId, Howl: HowlConstructor): HowlType {
  const clip: GameSoundClipConfig = gameSoundConfig.clips[soundId];
  return new Howl({
    src: [clip.src],
    volume: clip.volume,
    rate: clip.rate,
    preload: clip.preload,
    html5: false,
  });
}

async function resolveHowl(soundId: GameSoundId): Promise<HowlType | null> {
  if (!canUseAudioRuntime()) {
    return null;
  }

  const cached = howlBySoundId.get(soundId);
  if (cached) {
    return cached;
  }

  const pending = pendingHowlBySoundId.get(soundId);
  if (pending) {
    return pending;
  }

  const creation = (async () => {
    const Howl = await loadHowlConstructor();
    if (!Howl) {
      return null;
    }

    const howl = createHowl(soundId, Howl);
    howlBySoundId.set(soundId, howl);
    return howl;
  })().finally(() => {
    pendingHowlBySoundId.delete(soundId);
  });

  pendingHowlBySoundId.set(soundId, creation);
  return creation;
}

function playSoundById(soundId: GameSoundId): void {
  if (!canUseAudioRuntime() || isGameSoundMuted) {
    return;
  }

  void resolveHowl(soundId).then((howl) => {
    howl?.play();
  });
}

function toCandidateCount(value: number): CandidateCount | null {
  return isCandidateCount(value) ? value : null;
}

export function playCandidateByCount(count: number): void {
  const candidateCount = toCandidateCount(count);
  if (!candidateCount) {
    return;
  }

  const soundId = gameSoundConfig.candidateSelectByCount[candidateCount];
  playSoundById(soundId);
}

export function playCandidateRemoveByCount(countBeforeRemove: number): void {
  const candidateCount = toCandidateCount(countBeforeRemove);
  if (!candidateCount) {
    return;
  }

  const soundId = gameSoundConfig.candidateRemoveByCount[candidateCount];
  playSoundById(soundId);
}

export function playBlink(playKey?: string): void {
  if (!claimEffectPlayOnce(playedBlinkTimestamps, playKey, Date.now())) {
    return;
  }

  playSoundById(gameSoundConfig.blinkSoundId);
}

export function playResult(success: boolean, playKey?: string): void {
  if (!claimEffectPlayOnce(playedResultTimestamps, playKey, Date.now())) {
    return;
  }

  playSoundById(
    success
      ? gameSoundConfig.resultSuccessSoundId
      : gameSoundConfig.resultFailureSoundId,
  );
}

export function playGameEnd(playKey?: string): void {
  if (!claimEffectPlayOnce(playedGameEndTimestamps, playKey, Date.now())) {
    return;
  }

  playSoundById(gameSoundConfig.gameEndSoundId);
}

export function preloadAllGameSounds(): void {
  if (!canUseAudioRuntime()) {
    return;
  }

  const soundIds = Object.keys(gameSoundConfig.clips) as GameSoundId[];
  for (const soundId of soundIds) {
    void resolveHowl(soundId);
  }
}

export function setGameSoundMuted(muted: boolean): void {
  isGameSoundMuted = muted;
  if (!canUseAudioRuntime()) {
    return;
  }

  void loadHowlerGlobal().then((howler) => {
    howler?.mute(muted);
  });
}

export function getGameSoundMutedForTest(): boolean {
  return isGameSoundMuted;
}

export function clearGameSoundPlaybackStateForTest(): void {
  playedBlinkTimestamps.clear();
  playedResultTimestamps.clear();
  playedGameEndTimestamps.clear();
  pendingHowlBySoundId.clear();
  howlBySoundId.clear();
  howlerModulePromise = null;
  isGameSoundMuted = false;
}

export { claimEffectPlayOnce };
