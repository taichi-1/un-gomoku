/**
 * Main-thread client for the engine worker: lazy spawn, warm-up, promise-based
 * computeMove with request correlation, one init retry, and an emergency
 * fallback so a game never hangs on engine failure.
 */

import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import { emergencyMove } from "./difficulty";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import {
  type CpuDifficulty,
  cellXY,
  flattenBoard,
  playerToStone,
} from "./types";

/** Thrown from computeMove when the request was cancelled (rematch/unmount). */
export class EngineCancelledError extends Error {
  constructor() {
    super("engine request cancelled");
    this.name = "EngineCancelledError";
  }
}

export interface EngineComputeResult {
  candidates: Coordinate[];
  /** True when the engine failed and an emergency move was substituted. */
  fallback: boolean;
}

export type WorkerFactory = () => Worker;

const MODEL_URL = "/models/ungomoku-v1.onnx";
const WASM_PATH_PREFIX = "/ort/";
const INIT_ATTEMPTS = 2;

function defaultWorkerFactory(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
}

interface PendingRequest {
  resolve: (cells: number[]) => void;
  reject: (error: Error) => void;
}

export class EngineClient {
  private workerFactory: WorkerFactory;
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private nextRequestId = 1;
  private pending = new Map<number, PendingRequest>();

  constructor(workerFactory: WorkerFactory = defaultWorkerFactory) {
    this.workerFactory = workerFactory;
  }

  /** Starts loading ORT + model in the background (call on CPU page mount). */
  warmUp(): Promise<void> {
    this.readyPromise ??= this.initWithRetry(INIT_ATTEMPTS);
    return this.readyPromise;
  }

  private async initWithRetry(attempts: number): Promise<void> {
    let lastError: Error = new Error("engine init failed");
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        await this.initOnce();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.disposeWorker();
      }
    }
    this.readyPromise = null; // allow a later retry
    throw lastError;
  }

  private initOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = this.workerFactory();
      this.worker = worker;
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.type === "ready") {
          worker.removeEventListener("error", onSpawnError);
          resolve();
          return;
        }
        if (message.type === "initError") {
          reject(new Error(message.message));
          return;
        }
        this.handleComputeResponse(message);
      };
      const onSpawnError = (event: ErrorEvent) => {
        reject(new Error(event.message || "engine worker failed to start"));
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onSpawnError);
      this.send({
        type: "init",
        wasmPathPrefix: WASM_PATH_PREFIX,
        modelUrl: MODEL_URL,
      });
    });
  }

  private handleComputeResponse(
    message: Extract<WorkerResponse, { type: "result" | "computeError" }>,
  ): void {
    const pending = this.pending.get(message.requestId);
    if (!pending) return; // stale response (rematch/unmount) — discard
    this.pending.delete(message.requestId);
    if (message.type === "result") {
      pending.resolve(message.cells);
    } else {
      pending.reject(new Error(message.message));
    }
  }

  private send(message: WorkerRequest): void {
    if (!this.worker) throw new Error("engine worker not started");
    this.worker.postMessage(message);
  }

  /**
   * Computes a move; on engine failure returns an emergency move instead of
   * throwing, so the game continues.
   */
  async computeMove(
    board: BoardState,
    player: PlayerId,
    difficulty: CpuDifficulty,
  ): Promise<EngineComputeResult> {
    const flat = flattenBoard(board);
    try {
      await this.warmUp();
      const cells = await new Promise<number[]>((resolve, reject) => {
        const requestId = this.nextRequestId++;
        this.pending.set(requestId, { resolve, reject });
        this.send({
          type: "compute",
          requestId,
          board: flat,
          toMove: playerToStone(player),
          difficulty,
        });
      });
      if (cells.length === 0) throw new Error("engine returned no cells");
      return { candidates: cells.map(cellXY), fallback: false };
    } catch (error) {
      if (error instanceof EngineCancelledError) throw error;
      console.error("[ai] engine failed; using emergency move", error);
      const cells = emergencyMove(flat, Math.random);
      return { candidates: cells.map(cellXY), fallback: true };
    }
  }

  /** Cancels in-flight requests (responses arriving later are discarded). */
  cancelAll(): void {
    for (const [, pending] of this.pending) {
      pending.reject(new EngineCancelledError());
    }
    this.pending.clear();
  }

  private disposeWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

let singleton: EngineClient | null = null;

export function getEngineClient(): EngineClient {
  singleton ??= new EngineClient();
  return singleton;
}
