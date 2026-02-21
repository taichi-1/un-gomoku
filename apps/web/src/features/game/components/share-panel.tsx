import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Share2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { GameSessionStatus } from "@/features/game/types/game-session";
import { cn } from "@/lib/cn";

interface SharePanelProps {
  roomId: string | null;
  shareUrl: string | null;
  status: GameSessionStatus;
  statusMessage: string | null;
}

type TriggerType = "invite" | "error" | "connecting" | "normal";

function getTriggerType(status: GameSessionStatus): TriggerType {
  if (status === "waiting") return "invite";
  if (status === "error" || status === "disconnected") return "error";
  if (status === "connecting" || status === "idle") return "connecting";
  return "normal";
}

type CopiedKey = "roomId" | "roomUrl" | null;

export function SharePanel({
  roomId,
  shareUrl,
  status,
  statusMessage,
}: SharePanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<CopiedKey>(null);
  const ref = useRef<HTMLDivElement>(null);

  const triggerType = getTriggerType(status);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

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

  async function copyText(text: string, key: CopiedKey): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1200);
  }

  async function handleCopyRoomId(): Promise<void> {
    if (!roomId) return;
    await copyText(roomId, "roomId");
  }

  async function handleCopyRoomUrl(): Promise<void> {
    if (!shareUrl) return;
    await copyText(shareUrl, "roomUrl");
  }

  async function handleShareUrl(): Promise<void> {
    if (!shareUrl) return;
    if (canNativeShare) {
      await navigator.share({ title: t("common.appName"), url: shareUrl });
      setOpen(false);
    } else {
      window.open(shareUrl, "_blank", "noreferrer");
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <Trigger
        triggerType={triggerType}
        open={open}
        onClick={() => setOpen((v) => !v)}
        t={t}
      />

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-md border border-(--border-1) bg-(--surface-2) shadow-lg">
          {triggerType === "error" && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-(--accent-crimson-1)">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{statusMessage ?? t("status.error")}</span>
            </div>
          )}

          {!roomId && triggerType !== "error" && (
            <div className="px-3 py-2.5 text-sm text-(--text-muted)">
              {t("status.connecting")}
            </div>
          )}

          {roomId && (
            <>
              {triggerType === "error" && (
                <div className="border-t border-(--border-1)" />
              )}
              <RoomIdCard
                roomId={roomId}
                copied={copiedKey === "roomId"}
                onCopy={handleCopyRoomId}
              />
              <div className="border-t border-(--border-1)">
                <MenuButton
                  onClick={handleCopyRoomUrl}
                  disabled={!shareUrl}
                  icon={
                    <Copy className="h-3.5 w-3.5 shrink-0 text-(--text-muted)" />
                  }
                  iconActive={
                    <Check className="h-3.5 w-3.5 shrink-0 text-(--state-success)" />
                  }
                  active={copiedKey === "roomUrl"}
                >
                  {t("game.copyInvite")}
                </MenuButton>
                <MenuButton
                  onClick={handleShareUrl}
                  disabled={!shareUrl}
                  icon={
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-(--text-muted)" />
                  }
                  iconActive={null}
                  active={false}
                >
                  {canNativeShare ? t("game.shareUrl") : t("game.openUrl")}
                </MenuButton>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface TriggerProps {
  triggerType: TriggerType;
  open: boolean;
  onClick: () => void;
  t: (key: string) => string;
}

function Trigger({ triggerType, open, onClick, t }: TriggerProps) {
  if (triggerType === "invite") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="game-status-label flex min-h-9 items-center gap-1.5 rounded-sm border border-(--border-1) bg-(--surface-1) px-[0.65rem] py-[0.45rem] text-(--text-normal) transition-colors hover:bg-(--surface-2) hover:text-(--text-strong) sm:px-3 sm:py-2"
      >
        <Share2 className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
        {t("game.inviteButton")}
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform sm:h-3.5 sm:w-3.5",
            open && "rotate-180",
          )}
        />
      </button>
    );
  }

  if (triggerType === "error") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("status.error")}
        onClick={onClick}
        className="h-9 w-9 p-0 text-(--accent-crimson-1) hover:bg-(--tone-error-soft-bg) hover:text-(--text-strong)"
      >
        <AlertCircle className="h-5 w-5" />
      </Button>
    );
  }

  if (triggerType === "connecting") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("status.connecting")}
        onClick={onClick}
        className="h-9 w-9 p-0 text-(--text-muted) hover:text-(--text-normal)"
      >
        <Share2 className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={t("game.shareInvite")}
      onClick={onClick}
      className="h-9 w-9 p-0"
    >
      <Share2 className="h-5 w-5" />
    </Button>
  );
}

interface RoomIdCardProps {
  roomId: string;
  copied: boolean;
  onCopy: () => void;
}

function RoomIdCard({ roomId, copied, onCopy }: RoomIdCardProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onCopy}
      className="group flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-(--border-1)"
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs text-(--text-muted)">
          {t("common.roomId")}:
        </span>
        <span className="font-mono text-base font-semibold tracking-widest text-(--text-strong)">
          {roomId}
        </span>
      </div>
      <span className="ml-2 shrink-0">
        {copied ? (
          <span className="flex items-center gap-1 text-xs text-(--state-success)">
            <Check className="h-3.5 w-3.5" />
            {t("game.copied")}
          </span>
        ) : (
          <Copy className="h-3.5 w-3.5 text-(--text-muted) transition-colors group-hover:text-(--text-normal)" />
        )}
      </span>
    </button>
  );
}

interface MenuButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  iconActive: React.ReactNode;
}

function MenuButton({
  children,
  onClick,
  active,
  disabled = false,
  icon,
  iconActive,
}: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--text-normal)",
        "hover:bg-(--border-1) transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {active && iconActive ? iconActive : icon}
      {children}
    </button>
  );
}
