# @app/server

Authoritative game server on Cloudflare Worker + Durable Object. Acts as the single source of truth for game state.

## Responsibilities

- WebSocket connection management
- Room lifecycle (create/join, disconnect handling)
- Server-side validation for candidate submissions
- Randomness generation (success/failure based on probability)
- State transitions and win/draw computation
- Broadcasting state to clients
