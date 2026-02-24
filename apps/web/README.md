# @app/web

React frontend for un-gomoku.

## Responsibilities

- Title screen and game screen routing (`/`, `/local`, `/online/:roomId`)
- Shared game UI for local and online play
- Local mode game resolution using `@pkg/core`
- Online mode synchronization through WebSocket events
- i18n (`ja` / `en`) and responsive mobile-first layout

## Development

```bash
# from repository root
bun run dev:web

# build
bun run build:web

# typecheck
bun run typecheck
```

## Online API Endpoint

- `VITE_API_BASE_URL` can be set in `apps/web/.env.local`.
- If not set, the app uses the current page origin.
