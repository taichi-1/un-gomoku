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
bun run gen:parity   # Regenerate TS<->Python rule parity fixtures
bun run deploy:worker
```

## CPU opponent (NN engine)

The CPU opponent is an AlphaZero-style network trained by self-play in
[`ml/`](ml/README.md) (PyTorch, uv-managed). The exported ONNX model is a
static asset (`apps/web/public/models/`) evaluated in the browser by
onnxruntime-web inside a Web Worker — no server inference, no running cost.
Difficulty levels share one model and differ in search budget and sampling
noise (`apps/web/src/features/game/lib/ai/`).

The pre-NN expectiminimax CPU is frozen under `tools/parity-arena/src/baseline/`
as the arena strength baseline.

## License

MIT
