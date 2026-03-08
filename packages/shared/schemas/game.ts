import * as v from "valibot";
import {
  BoardStateSchema,
  CoordinateSchema,
  GamePhaseSchema,
  PlayerIdSchema,
} from "./primitives";

// ===== Game State Schemas =====

/** Schema for turn result data transfer object */
export const TurnResultDTOSchema = v.object({
  success: v.boolean(),
  placedPosition: v.nullable(CoordinateSchema),
  candidates: v.array(CoordinateSchema),
  player: PlayerIdSchema,
  gameOver: v.boolean(),
  winner: v.nullable(PlayerIdSchema),
});

/** Schema for game state data transfer object */
export const GameStateDTOSchema = v.object({
  board: BoardStateSchema,
  currentPlayer: PlayerIdSchema,
  blackPlayer: PlayerIdSchema,
  phase: GamePhaseSchema,
  winner: v.nullable(PlayerIdSchema),
  isDraw: v.boolean(),
  turnHistory: v.array(TurnResultDTOSchema),
});

// ===== Inferred Types =====

/** Game state data transfer object */
export type GameStateDTO = v.InferOutput<typeof GameStateDTOSchema>;

/** Turn result data transfer object */
export type TurnResultDTO = v.InferOutput<typeof TurnResultDTOSchema>;
