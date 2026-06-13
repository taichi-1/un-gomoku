export const TUTORIAL_SEEN_STORAGE_KEY = "ungomoku.tutorialSeen";

export function hasSeenTutorial(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(TUTORIAL_SEEN_STORAGE_KEY, "1");
  } catch {
    // Storage may be unavailable (e.g. blocked); the title nudge just stays on.
  }
}
