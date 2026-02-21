import { Link } from "@tanstack/react-router";
import { InfoPanel } from "@/components/info-panel";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/cn";

interface AppHeaderProps {
  showBrand: boolean;
  rules: string[];
}

export function AppHeader({ showBrand, rules }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center",
        showBrand ? "justify-between" : "justify-end",
      )}
    >
      {showBrand ? (
        <Link
          to="/"
          className="font-display text-lg font-semibold tracking-wide text-(--text-muted) transition-colors hover:text-(--text-strong)"
        >
          un-gomoku
        </Link>
      ) : null}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
        <InfoPanel rules={rules} />
      </div>
    </header>
  );
}
