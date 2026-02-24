export const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;
export const ROOM_STORAGE_KEY = "room:v1";
export const ROOM_TTL_MS = 30 * 60 * 1000;
export const MAX_ROOM_CREATE_ATTEMPTS = 5;
export const MAX_MESSAGE_BYTES = 8 * 1024;
export const RATE_LIMIT_WINDOW_MS = 10_000;
export const RATE_LIMIT_COUNT = 120;
