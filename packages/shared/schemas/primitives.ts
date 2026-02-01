import * as v from "valibot";
import { BOARD_SIZE } from "../constants";

// ===== Primitive Schemas =====

/** Schema for player identifiers */
export const PlayerIdSchema = v.picklist(["player1", "player2"]);

/** Schema for board coordinate (x or y value) */
const CoordinateValueSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(BOARD_SIZE - 1),
);

/** Schema for a coordinate on the game board */
export const CoordinateSchema = v.object({
  x: CoordinateValueSchema,
  y: CoordinateValueSchema,
});

/** Schema for the state of a single cell (null = empty, or player ID) */
export const CellStateSchema = v.nullable(PlayerIdSchema);

/** Schema for the entire board state (2D array of cells) */
export const BoardStateSchema = v.array(v.array(CellStateSchema));

/** Schema for game phase */
export const GamePhaseSchema = v.picklist(["waiting", "playing", "finished"]);

// ===== Inferred Types =====

/** Player identifier type */
export type PlayerId = v.InferOutput<typeof PlayerIdSchema>;

/** Coordinate on the game board */
export type Coordinate = v.InferOutput<typeof CoordinateSchema>;

/** State of a single cell */
export type CellState = v.InferOutput<typeof CellStateSchema>;

/** State of the entire board */
export type BoardState = v.InferOutput<typeof BoardStateSchema>;

/** Current phase of the game */
export type GamePhase = v.InferOutput<typeof GamePhaseSchema>;
