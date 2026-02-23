import { atom } from "jotai";
import { detectInitialSoundMuted } from "@/features/sound/sound-preference";

export const soundMutedAtom = atom<boolean>(detectInitialSoundMuted());
