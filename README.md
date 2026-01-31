# un-gomoku

A 2-player board game with probabilistic stone placement mechanics. Based on Gomoku (Five in a Row), this web game adds elements of strategy and risk management.

## Game Rules

- Turn-based gameplay between two players
- Select 1-5 candidate positions per turn
- Placement success rate varies based on number of selections:
  - 1 position → 50%
  - 2 positions → 60%
  - 3 positions → 70%
  - 4 positions → 80%
  - 5 positions → 90%
- On success → A stone is placed at one random position among the candidates
- On failure → No stone is placed, turn passes to opponent
- Win condition: Line up 5 stones in a row (horizontal, vertical, or diagonal)

## Project Structure

```
un-gomoku/
├── apps/
│   ├── server/     # WebSocket server (port 3000)
│   └── web/        # Frontend (port 8080)
├── packages/
│   ├── core/       # Game logic (pure functions)
│   └── shared/     # Type definitions, constants, schemas
├── package.json
└── tsconfig.json
```

### Package Responsibilities

| Package | Responsibility |
|---------|----------------|
| `@app/server` | WebSocket connection management, room management, server-side validation, random number generation, state transitions |
| `@app/web` | Board rendering, candidate selection UI, WebSocket client |
| `@pkg/core` | Board/state domain logic, win detection, candidate validation (no side effects) |
| `@pkg/shared` | Type definitions, WebSocket event names, constants |

## Setup

```bash
# Install dependencies
bun install
```

## Development Commands

```bash
# Start server (hot reload)
bun run dev:server

# Start web server (hot reload)
bun run dev:web

# Run all tests
bun test

# Run tests for individual packages
bun run test:shared
bun run test:core
bun run test:server
bun run test:web

# Lint
bun run lint

# Lint (auto-fix)
bun run lint:fix

# Format
bun run format

# Type check
bun run typecheck
```

## How to Play

1. Start the server: `bun run dev:server`
2. Start the web server: `bun run dev:web`
3. Open `http://localhost:8080` in your browser
4. Click "Create Room" to get a room ID
5. Open the same URL in another browser/tab, enter the room ID, and click "Join"

## Tech Stack

- **Runtime**: Bun
- **Server**: `Bun.serve()` + WebSocket
- **Linter/Formatter**: Biome
- **Version Control**: Git

## License

MIT
