import { CircleHelp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface InfoPanelProps {
  rules: string[];
}

export function InfoPanel({ rules }: InfoPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("header.info")}
        title={t("header.info")}
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 rounded-sm p-0 hover:bg-transparent"
      >
        <CircleHelp className="h-5 w-5" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-md border border-(--border-1) bg-(--surface-2) shadow-lg">
          <div className="border-b border-(--border-1) px-3 py-2.5">
            <p className="text-xs font-medium text-(--text-muted)">
              {t("header.info")}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <ul className="space-y-1 text-xs text-(--text-normal)">
              {rules.map((rule) => (
                <li key={rule} className="flex gap-1.5">
                  <span className="mt-px text-(--text-muted)">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
