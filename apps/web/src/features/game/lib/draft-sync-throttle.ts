import type { Coordinate } from "@pkg/shared/schemas";

export interface DraftSyncThrottle {
  enqueue(candidates: Coordinate[]): void;
  flush(): boolean;
  dispose(): void;
}

interface DraftSyncThrottleOptions {
  intervalMs: number;
  send: (candidates: Coordinate[]) => boolean | undefined;
  scheduleTimeout?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  clearScheduledTimeout?: (timeoutId: ReturnType<typeof setTimeout>) => void;
}

function didSendSucceed(result: boolean | undefined): boolean {
  return result !== false;
}

export function createDraftSyncThrottle(
  options: DraftSyncThrottleOptions,
): DraftSyncThrottle {
  const intervalMs = Math.max(0, options.intervalMs);
  const scheduleTimeout =
    options.scheduleTimeout ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const clearScheduledTimeout = options.clearScheduledTimeout ?? clearTimeout;

  let isCoolingDown = false;
  let pending: Coordinate[] | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (!timerId) {
      return;
    }
    clearScheduledTimeout(timerId);
    timerId = null;
  };

  const dispatch = (candidates: Coordinate[]): boolean =>
    didSendSucceed(options.send(candidates));

  const beginCooldown = (): void => {
    isCoolingDown = true;
    clearTimer();
    timerId = scheduleTimeout(() => {
      timerId = null;
      if (!pending) {
        isCoolingDown = false;
        return;
      }

      const queued = pending;
      pending = null;
      if (dispatch(queued)) {
        beginCooldown();
        return;
      }

      pending = queued;
      isCoolingDown = false;
    }, intervalMs);
  };

  return {
    enqueue(candidates: Coordinate[]) {
      if (!isCoolingDown) {
        pending = null;
        if (dispatch(candidates)) {
          beginCooldown();
        } else {
          pending = candidates;
        }
        return;
      }
      pending = candidates;
    },

    flush() {
      if (!pending) {
        return true;
      }

      if (!dispatch(pending)) {
        return false;
      }

      pending = null;
      if (isCoolingDown) {
        beginCooldown();
      }
      return true;
    },

    dispose() {
      clearTimer();
      isCoolingDown = false;
      pending = null;
    },
  };
}
