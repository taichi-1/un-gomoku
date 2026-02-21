import { atom } from "jotai";

export type DragMode = "select" | "deselect" | null;

export interface DragSelectionState {
  active: boolean;
  mode: DragMode;
  pointerId: number | null;
  visited: Record<string, true>;
}

export const idleDragSelectionState: DragSelectionState = {
  active: false,
  mode: null,
  pointerId: null,
  visited: {},
};

export const dragSelectionAtom = atom<DragSelectionState>(
  idleDragSelectionState,
);
