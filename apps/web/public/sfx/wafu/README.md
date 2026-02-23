# Wafu SFX preset

This preset uses lightweight WAV files for candidate, blink, and result effects.
You can replace any file here without touching gameplay code.

Mapped files:
- `candidate_1.wav` .. `candidate_5.wav`
- `blink_piko.wav`
- `result_success.wav`
- `result_failure.wav`
- `game_end.wav`

How to switch:
- Edit `apps/web/src/features/game/sound/game-sound-config.ts` and replace the `src` values for:
- `blink_piko`
- `result_success`
- `result_failure`
- `game_end_taiko`
