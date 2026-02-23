export const SOUND_MUTED_STORAGE_KEY = "ungomoku.sfxMuted";

export function normalizeSoundMuted(
  value: string | null | undefined,
): boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

export function detectInitialSoundMuted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const fromStorage = normalizeSoundMuted(
      window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY),
    );

    if (fromStorage !== null) {
      return fromStorage;
    }
  } catch {
    return false;
  }

  return false;
}

export function persistSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, String(muted));
  } catch {
    return;
  }
}
