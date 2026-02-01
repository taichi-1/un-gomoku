/** Random function returning [0, 1). Defaults to Math.random. */
export type RandomFn = () => number;

/**
 * Generates a player token for reconnect.
 * Uses a hex string derived from random bytes.
 */
export function generatePlayerToken(random: RandomFn = Math.random): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(random() * 256));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
