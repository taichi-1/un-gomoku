# @pkg/core

Pure game logic. Side-effect free.

## Responsibilities

- Board/state domain logic and rules
- Applying turn outcomes to state
- Win check (5-in-a-row), draw check, turn progression
- Candidate legality checks (in-bounds, empty cells)

## Constraints

- No I/O, no runtime APIs, no global state
- Randomness is injected by the server
