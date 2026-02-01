import * as v from "valibot";
import { ClientMessageSchema, ServerMessageSchema } from "./messages";

export * from "./game";
export * from "./messages";
// Re-export all schemas and types
export * from "./primitives";

// ===== Parse Utilities =====

/** Result type for parse operations */
export type ParseResult<T> = v.SafeParseResult<v.GenericSchema<T, T>>;

/**
 * Parses and validates a client message.
 * Use this to safely parse incoming WebSocket messages from clients.
 *
 * @param data - The unknown data to parse (typically from JSON.parse)
 * @returns A SafeParseResult with either success: true and output, or success: false and issues
 *
 * @example
 * ```ts
 * const json = JSON.parse(message.toString());
 * const result = parseClientMessage(json);
 * if (result.success) {
 *   const data = result.output; // Fully typed ClientMessage
 * } else {
 *   console.error(result.issues[0]?.message);
 * }
 * ```
 */
export function parseClientMessage(data: unknown) {
  return v.safeParse(ClientMessageSchema, data);
}

/**
 * Parses and validates a server message.
 * Use this to safely parse incoming WebSocket messages on the client side.
 *
 * @param data - The unknown data to parse (typically from JSON.parse)
 * @returns A SafeParseResult with either success: true and output, or success: false and issues
 */
export function parseServerMessage(data: unknown) {
  return v.safeParse(ServerMessageSchema, data);
}
