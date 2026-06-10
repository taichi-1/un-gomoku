"""Game constants. Mirrors packages/shared/constants.ts exactly."""

BOARD_SIZE = 15
MAX_CANDIDATES = 5
WIN_LENGTH = 5

# Success probability by candidate count. The float literals are identical to
# the TS source, so the IEEE-754 values match bit-for-bit.
SUCCESS_PROBABILITY: dict[int, float] = {
    1: 0.5,
    2: 0.6,
    3: 0.7,
    4: 0.8,
    5: 0.9,
}
