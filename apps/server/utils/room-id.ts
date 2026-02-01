/** Random function returning [0, 1). Defaults to Math.random. */
export type RandomFn = () => number;

/**
 * Generates a 6-character room ID using uppercase letters and digits.
 *
 * @param random - Optional random function for testing (default: Math.random)
 */
export function generateRoomId(random: RandomFn = Math.random): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(random() * chars.length));
  }
  return result;
}
