import type { Coordinate } from "@pkg/shared/schemas";
import { useAtom } from "jotai";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect } from "react";
import { coordinateKey, hasCoordinate } from "@/features/game/lib/candidate";
import {
  dragSelectionAtom,
  idleDragSelectionState,
} from "@/features/game/state/drag-selection-atom";

interface UseBoardSelectionOptions {
  canInteract: boolean;
  selectedCandidates: Coordinate[];
  isCellSelectable: (coord: Coordinate) => boolean;
  setCandidateSelection: (coord: Coordinate, shouldSelect: boolean) => void;
}

function parseCoordinateFromCell(target: Element | null): Coordinate | null {
  const cell = target?.closest<HTMLElement>("[data-board-cell='true']");
  if (!cell) {
    return null;
  }

  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }

  return { x, y };
}

export function useBoardSelection(options: UseBoardSelectionOptions) {
  const {
    canInteract,
    selectedCandidates,
    isCellSelectable,
    setCandidateSelection,
  } = options;
  const [drag, setDrag] = useAtom(dragSelectionAtom);

  const stopDrag = useCallback(() => {
    setDrag(idleDragSelectionState);
  }, [setDrag]);

  useEffect(() => {
    return () => {
      setDrag(idleDragSelectionState);
    };
  }, [setDrag]);

  const handleCellPointerDown = useCallback(
    (coord: Coordinate, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      if (drag.active) {
        return;
      }
      if (!canInteract || !isCellSelectable(coord)) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      const shouldSelect = !hasCoordinate(selectedCandidates, coord);
      setCandidateSelection(coord, shouldSelect);
      setDrag({
        active: true,
        mode: shouldSelect ? "select" : "deselect",
        pointerId: event.pointerId,
        visited: {
          [coordinateKey(coord)]: true,
        },
      });
    },
    [
      drag.active,
      canInteract,
      isCellSelectable,
      selectedCandidates,
      setCandidateSelection,
      setDrag,
    ],
  );

  const handleBoardPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.active || !drag.mode || drag.pointerId === null) {
        return;
      }
      if (event.pointerId !== drag.pointerId) {
        return;
      }

      const coord = parseCoordinateFromCell(
        document.elementFromPoint(event.clientX, event.clientY),
      );
      if (!coord || !isCellSelectable(coord)) {
        return;
      }

      const key = coordinateKey(coord);
      if (drag.visited[key]) {
        return;
      }

      setCandidateSelection(coord, drag.mode === "select");
      setDrag((previous) => ({
        ...previous,
        visited: {
          ...previous.visited,
          [key]: true,
        },
      }));
    },
    [
      drag.active,
      drag.mode,
      drag.pointerId,
      drag.visited,
      isCellSelectable,
      setCandidateSelection,
      setDrag,
    ],
  );

  const handleBoardPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.active || drag.pointerId === null) {
        return;
      }
      if (event.pointerId !== drag.pointerId) {
        return;
      }
      stopDrag();
    },
    [drag.active, drag.pointerId, stopDrag],
  );

  const handleBoardPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.active || drag.pointerId === null) {
        return;
      }
      if (event.pointerId !== drag.pointerId) {
        return;
      }
      stopDrag();
    },
    [drag.active, drag.pointerId, stopDrag],
  );

  const handleBoardLostPointerCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.active || drag.pointerId === null) {
        return;
      }
      if (event.pointerId !== drag.pointerId) {
        return;
      }
      stopDrag();
    },
    [drag.active, drag.pointerId, stopDrag],
  );

  useEffect(() => {
    if (!drag.active || drag.pointerId === null) {
      return;
    }

    const dragPointerId = drag.pointerId;
    const endDrag = (event: PointerEvent): void => {
      if (event.pointerId !== dragPointerId) {
        return;
      }
      stopDrag();
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [drag.active, drag.pointerId, stopDrag]);

  return {
    handleCellPointerDown,
    handleBoardPointerMove,
    handleBoardPointerUp,
    handleBoardPointerCancel,
    handleBoardLostPointerCapture,
  };
}
