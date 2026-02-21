import { atom } from "jotai";
import { detectInitialTheme, type ThemeMode } from "./theme";

export const themeAtom = atom<ThemeMode>(detectInitialTheme());
