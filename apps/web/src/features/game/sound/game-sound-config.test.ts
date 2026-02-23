import { describe, expect, test } from "bun:test";
import {
  ACTIVE_GAME_SOUND_PRESET,
  CANDIDATE_COUNTS,
  GAME_SOUND_PRESETS,
  gameSoundConfig,
} from "./game-sound-config";

describe("game-sound-config", () => {
  test("exposes active preset config", () => {
    expect(gameSoundConfig).toBe(GAME_SOUND_PRESETS[ACTIVE_GAME_SOUND_PRESET]);
  });

  test("defines candidate select/remove mapping for 1..5", () => {
    for (const count of CANDIDATE_COUNTS) {
      expect(gameSoundConfig.candidateSelectByCount[count]).toBe(
        `candidate_${count}`,
      );
      expect(gameSoundConfig.candidateRemoveByCount[count]).toBe(
        `candidate_${count}`,
      );
    }
  });

  test("all clip definitions have source and positive volume", () => {
    for (const clip of Object.values(gameSoundConfig.clips)) {
      expect(clip.src.length).toBeGreaterThan(0);
      expect(clip.volume).toBeGreaterThan(0);
      expect(clip.rate).toBeGreaterThan(0);
    }
  });

  test("defines dedicated game end taiko sound", () => {
    expect(gameSoundConfig.gameEndSoundId).toBe("game_end_taiko");
    expect(gameSoundConfig.clips.game_end_taiko.src).toBe(
      "/sfx/wafu/game_end.wav",
    );
  });
});
