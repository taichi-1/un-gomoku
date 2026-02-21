import { useAtomValue } from "jotai";
import { useLayoutEffect } from "react";
import i18n from "@/features/i18n/i18n";
import { languageAtom, persistLanguage } from "@/features/i18n/language";
import { applyThemeToDocument, persistTheme } from "@/features/theme/theme";
import { themeAtom } from "@/features/theme/theme-atom";

export function AppPreferencesSync() {
  const language = useAtomValue(languageAtom);
  const theme = useAtomValue(themeAtom);

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

  return null;
}
