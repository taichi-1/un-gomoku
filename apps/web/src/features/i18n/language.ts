import { atom } from "jotai";

export const LANGUAGE_STORAGE_KEY = "ungomoku.lang";

export const SUPPORTED_LANGUAGES = ["ja", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function normalizeLanguage(
  value: string | null | undefined,
): SupportedLanguage | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.startsWith("ja")) {
    return "ja";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return null;
}

export function detectInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") {
    return "ja";
  }

  const fromStorage = normalizeLanguage(
    window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
  );
  if (fromStorage) {
    return fromStorage;
  }

  return normalizeLanguage(window.navigator.language) ?? "ja";
}

export function persistLanguage(language: SupportedLanguage): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    return;
  }
}

export const languageAtom = atom<SupportedLanguage>(detectInitialLanguage());
