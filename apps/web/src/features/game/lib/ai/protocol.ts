/** Messages between engine-client (main thread) and worker. */

import type { CpuDifficulty } from "./types";

export interface InitRequest {
  type: "init";
  /** Base path for ORT wasm assets, e.g. "/ort/". */
  wasmPathPrefix: string;
  /** URL of the .onnx model, e.g. "/models/ungomoku-v1.onnx". */
  modelUrl: string;
}

export interface ComputeRequest {
  type: "compute";
  requestId: number;
  board: Int8Array;
  toMove: 1 | 2;
  difficulty: CpuDifficulty;
}

export type WorkerRequest = InitRequest | ComputeRequest;

export interface ReadyResponse {
  type: "ready";
}

export interface InitErrorResponse {
  type: "initError";
  message: string;
}

export interface MoveResponse {
  type: "result";
  requestId: number;
  cells: number[];
  rootValue: number;
  evalCount: number;
  thinkMs: number;
}

export interface ComputeErrorResponse {
  type: "computeError";
  requestId: number;
  message: string;
}

export type WorkerResponse =
  | ReadyResponse
  | InitErrorResponse
  | MoveResponse
  | ComputeErrorResponse;
