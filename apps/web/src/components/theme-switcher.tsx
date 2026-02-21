import { useAtom } from "jotai";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { themeAtom } from "@/features/theme/theme-atom";

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const [theme, setTheme] = useAtom(themeAtom);
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t("header.toggleTheme")}
      title={t("header.toggleTheme")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-10 w-10 rounded-sm p-0 hover:bg-transparent"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
