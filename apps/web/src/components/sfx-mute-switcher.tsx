import { useAtom } from "jotai";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { soundMutedAtom } from "@/features/sound/sound-preference-atom";

export function SfxMuteSwitcher() {
  const { t } = useTranslation();
  const [soundMuted, setSoundMuted] = useAtom(soundMutedAtom);

  const label = soundMuted
    ? t("header.toggleSfxUnmute")
    : t("header.toggleSfxMute");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      onClick={() => setSoundMuted((previous) => !previous)}
      className="h-10 w-10 rounded-sm p-0 hover:bg-transparent"
    >
      {soundMuted ? (
        <VolumeX className="h-5 w-5" />
      ) : (
        <Volume2 className="h-5 w-5" />
      )}
    </Button>
  );
}
