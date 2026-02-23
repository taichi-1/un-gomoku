import { useAtomValue } from "jotai";
import { useLayoutEffect } from "react";
import { setGameSoundMuted } from "@/features/game/sound/game-sound-player";
import i18n from "@/features/i18n/i18n";
import { languageAtom, persistLanguage } from "@/features/i18n/language";
import { persistSoundMuted } from "@/features/sound/sound-preference";
import { soundMutedAtom } from "@/features/sound/sound-preference-atom";
import { applyThemeToDocument, persistTheme } from "@/features/theme/theme";
import { themeAtom } from "@/features/theme/theme-atom";

export function AppPreferencesSync() {
  const language = useAtomValue(languageAtom);
  const theme = useAtomValue(themeAtom);
  const soundMuted = useAtomValue(soundMutedAtom);

  useLayoutEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }

    persistLanguage(language);
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language]);

  useLayoutEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme);
  }, [theme]);

  useLayoutEffect(() => {
    setGameSoundMuted(soundMuted);
    persistSoundMuted(soundMuted);
  }, [soundMuted]);

  return null;
}
