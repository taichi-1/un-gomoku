# un-gomoku

A 2-player board game with probabilistic stone placement mechanics. Based on Gomoku (Five in a Row), this web game adds strategy and risk management through probabilistic stone placement.

## Game Rules

- Turn-based gameplay between two players
- Select 1-5 candidate positions per turn
- Placement success rate varies based on number of selections:
  - 1 position -> 50%
  - 2 positions -> 60%
  - 3 positions -> 70%
  - 4 positions -> 80%
  - 5 positions -> 90%
- On success -> A stone is placed at one random position among the candidates
- On failure -> No stone is placed, turn passes to opponent
- Win condition: line up 5 stones in a row (horizontal, vertical, or diagonal)

## Project Structure

```text
un-gomoku/
├── apps/
│   ├── server/     # Cloudflare Worker + Durable Object WebSocket server (port 8787 in local dev)
│   └── web/        # React + Vite frontend (port 5173)
├── packages/
│   ├── core/       # Game logic (pure functions)
│   └── shared/     # Type definitions, constants, schemas
├── package.json
└── tsconfig.json
```

## Setup

```bash
bun install
```

## Development Commands

```bash
# Start Worker + Durable Object (local dev on port 8787)
bun run dev:worker

# Start web app (Vite)
bun run dev:web

# Build web app
bun run build:web

# Preview production build
bun run preview:web

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

1. Start the server: `bun run dev:worker`
2. Start the web app: `bun run dev:web`
3. Open `http://localhost:5173`
4. Choose local match or online match from the title screen
5. For online match, create a room or join from `/online/:roomId`

### Online Match in Development

- Set `VITE_ONLINE_MATCH_ENABLED=true` in `apps/web/.env.local`
- Optional: set `VITE_WS_URL=ws://localhost:8787/ws` (default fallback already points here)

## Tech Stack

- Runtime: Bun
- Frontend: React, Vite, Tailwind CSS, TanStack Router/Query, Jotai, shadcn/ui
- Server: Cloudflare Worker + Durable Object + WebSocket (routing with Hono)
- Linter/Formatter: Biome

## License

MIT
# Deploy Worker
bun run deploy:worker

# Generate worker types (optional)
bun run typegen:worker
