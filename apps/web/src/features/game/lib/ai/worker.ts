/**
 * Engine Web Worker: hosts the ONNX Runtime session and runs the search.
 * This is the only file that touches onnxruntime-web.
 */

import { computeEngineMove } from "./difficulty";
import { INPUT_SIZE } from "./features";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import type { Evaluate } from "./types";

type Ort = typeof import("onnxruntime-web");

let ortModule: Ort | null = null;
let session: import("onnxruntime-web").InferenceSession | null = null;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

async function init(wasmPathPrefix: string, modelUrl: string): Promise<void> {
  // ORT is deliberately NOT bundled: its wasm-only ESM build is served from
  // /ort/ (copied by vite-plugin-static-copy) and imported at runtime. This
  // keeps the multi-MB ORT assets out of the app bundle.
  const ort = (await import(
    /* @vite-ignore */ `${wasmPathPrefix}ort.wasm.min.mjs`
  )) as Ort;
  ortModule = ort;
  ort.env.wasm.wasmPaths = wasmPathPrefix;
  // Single-threaded WASM: no COOP/COEP requirement, maximum compatibility.
  ort.env.wasm.numThreads = 1;
  session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
  });
}

const evaluate: Evaluate = async (planes) => {
  if (!session || !ortModule) throw new Error("engine not initialized");
  const batch = planes.length;
  const input = new Float32Array(batch * INPUT_SIZE);
  planes.forEach((p, i) => {
    input.set(p, i * INPUT_SIZE);
  });
  const tensor = new ortModule.Tensor("float32", input, [batch, 3, 15, 15]);
  const inputName = session.inputNames[0] ?? "board";
  const outputs = await session.run({ [inputName]: tensor });
  const logitsOut = outputs[session.outputNames[0] ?? "policy_logits"];
  const valuesOut = outputs[session.outputNames[1] ?? "value"];
  if (!logitsOut || !valuesOut) throw new Error("unexpected model outputs");
  const logitsData = logitsOut.data as Float32Array;
  const valuesData = valuesOut.data as Float32Array;
  const logits: Float32Array[] = [];
  const values: number[] = [];
  for (let i = 0; i < batch; i++) {
    logits.push(logitsData.subarray(i * 225, (i + 1) * 225));
    values.push(valuesData[i] as number);
  }
  return { logits, values };
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    try {
      await init(message.wasmPathPrefix, message.modelUrl);
      post({ type: "ready" });
    } catch (error) {
      post({
        type: "initError",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (message.type === "compute") {
    try {
      const move = await computeEngineMove(
        message.board,
        message.toMove,
        message.difficulty,
        evaluate,
        Math.random,
      );
      post({
        type: "result",
        requestId: message.requestId,
        cells: move.cells,
        rootValue: move.rootValue,
        evalCount: move.evalCount,
        thinkMs: move.thinkMs,
      });
    } catch (error) {
      post({
        type: "computeError",
        requestId: message.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
