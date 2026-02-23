export const GAME_SOUND_PRESET_NAMES = ["wafu"] as const;

export type GameSoundPresetName = (typeof GAME_SOUND_PRESET_NAMES)[number];

export const CANDIDATE_COUNTS = [1, 2, 3, 4, 5] as const;

export type CandidateCount = (typeof CANDIDATE_COUNTS)[number];

const GAME_SOUND_IDS = [
  "candidate_1",
  "candidate_2",
  "candidate_3",
  "candidate_4",
  "candidate_5",
  "blink_piko",
  "result_success",
  "result_failure",
  "game_end_taiko",
] as const;

export type GameSoundId = (typeof GAME_SOUND_IDS)[number];

export interface GameSoundClipConfig {
  src: string;
  volume: number;
  rate: number;
  preload: boolean;
}

export interface GameSoundPresetConfig {
  clips: Record<GameSoundId, GameSoundClipConfig>;
  candidateSelectByCount: Record<CandidateCount, GameSoundId>;
  candidateRemoveByCount: Record<CandidateCount, GameSoundId>;
  blinkSoundId: GameSoundId;
  resultSuccessSoundId: GameSoundId;
  resultFailureSoundId: GameSoundId;
  gameEndSoundId: GameSoundId;
}

const WAFU_SOUND_CLIPS: Record<GameSoundId, GameSoundClipConfig> = {
  candidate_1: {
    src: "/sfx/wafu/candidate_1.wav",
    volume: 0.46,
    rate: 1,
    preload: true,
  },
  candidate_2: {
    src: "/sfx/wafu/candidate_2.wav",
    volume: 0.46,
    rate: 1,
    preload: true,
  },
  candidate_3: {
    src: "/sfx/wafu/candidate_3.wav",
    volume: 0.47,
    rate: 1,
    preload: true,
  },
  candidate_4: {
    src: "/sfx/wafu/candidate_4.wav",
    volume: 0.48,
    rate: 1,
    preload: true,
  },
  candidate_5: {
    src: "/sfx/wafu/candidate_5.wav",
    volume: 0.49,
    rate: 1,
    preload: true,
  },
  blink_piko: {
    src: "/sfx/wafu/blink_piko.wav",
    volume: 0.32,
    rate: 1,
    preload: true,
  },
  result_success: {
    src: "/sfx/wafu/result_success.wav",
    volume: 0.52,
    rate: 1,
    preload: true,
  },
  result_failure: {
    src: "/sfx/wafu/result_failure.wav",
    volume: 0.54,
    rate: 1,
    preload: true,
  },
  game_end_taiko: {
    src: "/sfx/wafu/game_end.wav",
    volume: 0.62,
    rate: 1,
    preload: true,
  },
};

const WAFU_CANDIDATE_TONES: Record<CandidateCount, GameSoundId> = {
  1: "candidate_1",
  2: "candidate_2",
  3: "candidate_3",
  4: "candidate_4",
  5: "candidate_5",
};

export const GAME_SOUND_PRESETS: Record<
  GameSoundPresetName,
  GameSoundPresetConfig
> = {
  wafu: {
    clips: WAFU_SOUND_CLIPS,
    candidateSelectByCount: WAFU_CANDIDATE_TONES,
    candidateRemoveByCount: WAFU_CANDIDATE_TONES,
    blinkSoundId: "blink_piko",
    resultSuccessSoundId: "result_success",
    resultFailureSoundId: "result_failure",
    gameEndSoundId: "game_end_taiko",
  },
};

export const ACTIVE_GAME_SOUND_PRESET: GameSoundPresetName = "wafu";

export const gameSoundConfig = GAME_SOUND_PRESETS[ACTIVE_GAME_SOUND_PRESET];

export function isCandidateCount(value: number): value is CandidateCount {
  return CANDIDATE_COUNTS.includes(value as CandidateCount);
}
