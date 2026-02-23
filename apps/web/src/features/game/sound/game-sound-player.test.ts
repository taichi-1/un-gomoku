import { beforeEach, describe, expect, test } from "bun:test";
import {
  claimEffectPlayOnce,
  clearGameSoundPlaybackStateForTest,
  getGameSoundMutedForTest,
  setGameSoundMuted,
} from "./game-sound-player";

beforeEach(() => {
  clearGameSoundPlaybackStateForTest();
});

describe("game-sound-player dedupe", () => {
  test("allows playback when no key is provided", () => {
    const played = new Map<string, number>();

    expect(claimEffectPlayOnce(played, undefined, 1_000)).toBe(true);
    expect(claimEffectPlayOnce(played, null, 1_000)).toBe(true);
  });

  test("blocks duplicate playback in the dedupe window", () => {
    const played = new Map<string, number>();

    expect(claimEffectPlayOnce(played, "fx-1:step-2", 1_000, 1_600)).toBe(true);
    expect(claimEffectPlayOnce(played, "fx-1:step-2", 1_400, 1_600)).toBe(
      false,
    );
    expect(claimEffectPlayOnce(played, "fx-1:step-2", 2_800, 1_600)).toBe(true);
  });

  test("dedupes game end key in the same window", () => {
    const played = new Map<string, number>();

    expect(claimEffectPlayOnce(played, "end:42:player1", 5_000, 1_600)).toBe(
      true,
    );
    expect(claimEffectPlayOnce(played, "end:42:player1", 5_800, 1_600)).toBe(
      false,
    );
    expect(claimEffectPlayOnce(played, "end:42:player1", 6_700, 1_600)).toBe(
      true,
    );
  });

  test("setGameSoundMuted updates state and is safe without browser runtime", () => {
    expect(() => setGameSoundMuted(true)).not.toThrow();
    expect(getGameSoundMutedForTest()).toBe(true);

    expect(() => setGameSoundMuted(false)).not.toThrow();
    expect(getGameSoundMutedForTest()).toBe(false);
  });
});
