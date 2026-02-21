import { useAtom } from "jotai";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { languageAtom } from "@/features/i18n/language";

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const [language, setLanguage] = useAtom(languageAtom);

  const nextLanguage = language === "ja" ? "en" : "ja";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t("header.toggleLanguage")}
      title={t("header.toggleLanguage")}
      onClick={() => setLanguage(nextLanguage)}
      className="h-10 w-10 rounded-sm p-0 hover:bg-transparent"
    >
      <Languages className="h-5 w-5" />
    </Button>
  );
}
