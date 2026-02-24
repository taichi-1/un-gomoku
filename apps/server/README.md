# @app/server

Authoritative game server on Cloudflare Worker + Durable Object. Acts as the single source of truth for game state.

## Responsibilities

- HTTP room lifecycle endpoint (`POST /rooms`)
- Room-scoped WebSocket endpoint (`GET /ws/:roomId`)
- Room management with 1 Room = 1 Durable Object
- Server-side validation for candidate submissions
- Randomness generation (success/failure based on probability)
- State transitions and win/draw computation
- Broadcasting state to clients
- Reconnect support with player token
- TTL cleanup using Durable Object alarms
