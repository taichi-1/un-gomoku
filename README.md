# un-gomoku

A real-time multiplayer Gomoku game with probabilistic stone placement mechanics.

## Setup

```bash
bun install
```

## Development

```bash
bun run dev:worker   # Cloudflare Worker + Durable Object (port 8787)
bun run dev:web      # React + Vite frontend (port 5173)
```

## Other Commands

```bash
bun test             # Run all tests
bun run lint         # Lint
bun run lint:fix     # Lint (auto-fix)
bun run format       # Format
bun run typecheck    # Type check
bun run deploy:worker
```

## License

MIT
