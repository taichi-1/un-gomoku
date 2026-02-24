import { describe, expect, test } from "bun:test";
import type { Coordinate } from "@pkg/shared/schemas";
import { createDraftSyncThrottle } from "./draft-sync-throttle";

interface ManualTimer {
  schedule(
    callback: () => void,
    _delayMs: number,
  ): ReturnType<typeof setTimeout>;
  clear(timeoutId: ReturnType<typeof setTimeout>): void;
  runNext(): boolean;
  pendingCount(): number;
}

function createManualTimer(): ManualTimer {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();

  return {
    schedule(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clear(timeoutId) {
      const id = Number(timeoutId);
      callbacks.delete(id);
    },
    runNext() {
      const next = callbacks.entries().next().value;
      if (!next) {
        return false;
      }
      const [id, callback] = next;
      callbacks.delete(id);
      callback();
      return true;
    },
    pendingCount() {
      return callbacks.size;
    },
  };
}

function coord(x: number, y: number): Coordinate {
  return { x, y };
}

describe("createDraftSyncThrottle", () => {
  test("sends first update immediately and aggregates rapid trailing updates", () => {
    const timer = createManualTimer();
    const sent: Coordinate[][] = [];
    const throttle = createDraftSyncThrottle({
      intervalMs: 100,
      send: (candidates) => {
        sent.push(candidates);
        return undefined;
      },
      scheduleTimeout: timer.schedule,
      clearScheduledTimeout: timer.clear,
    });

    throttle.enqueue([coord(0, 0)]);
    throttle.enqueue([coord(1, 1)]);
    throttle.enqueue([coord(2, 2)]);

    expect(sent).toEqual([[coord(0, 0)]]);
    expect(timer.pendingCount()).toBe(1);

    timer.runNext();
    expect(sent).toEqual([[coord(0, 0)], [coord(2, 2)]]);
    expect(timer.pendingCount()).toBe(1);

    timer.runNext();
    expect(sent).toEqual([[coord(0, 0)], [coord(2, 2)]]);
    expect(timer.pendingCount()).toBe(0);
  });

  test("flush sends pending update immediately", () => {
    const timer = createManualTimer();
    const sent: Coordinate[][] = [];
    const throttle = createDraftSyncThrottle({
      intervalMs: 100,
      send: (candidates) => {
        sent.push(candidates);
        return undefined;
      },
      scheduleTimeout: timer.schedule,
      clearScheduledTimeout: timer.clear,
    });

    throttle.enqueue([coord(0, 0)]);
    throttle.enqueue([coord(3, 3)]);
    expect(sent).toEqual([[coord(0, 0)]]);

    const flushResult = throttle.flush();
    expect(flushResult).toBe(true);
    expect(sent).toEqual([[coord(0, 0)], [coord(3, 3)]]);
    expect(timer.pendingCount()).toBe(1);

    timer.runNext();
    expect(sent).toEqual([[coord(0, 0)], [coord(3, 3)]]);
    expect(timer.pendingCount()).toBe(0);
  });

  test("dispose clears pending timer and queued updates", () => {
    const timer = createManualTimer();
    const sent: Coordinate[][] = [];
    const throttle = createDraftSyncThrottle({
      intervalMs: 100,
      send: (candidates) => {
        sent.push(candidates);
        return undefined;
      },
      scheduleTimeout: timer.schedule,
      clearScheduledTimeout: timer.clear,
    });

    throttle.enqueue([coord(0, 0)]);
    throttle.enqueue([coord(4, 4)]);
    expect(timer.pendingCount()).toBe(1);

    throttle.dispose();
    expect(timer.pendingCount()).toBe(0);

    const ran = timer.runNext();
    expect(ran).toBe(false);
    expect(sent).toEqual([[coord(0, 0)]]);
  });
});
