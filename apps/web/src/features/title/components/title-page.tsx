import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { preloadAllGameSounds } from "@/features/game/sound/game-sound-player";
import { type CreatedRoom, createRoom } from "@/features/title/lib/create-room";
import { saveRoomAuth } from "@/lib/room-auth-storage";

const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;

function normalizeRoomIdInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function TitlePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [joinRoomInput, setJoinRoomInput] = useState("");

  useEffect(() => {
    preloadAllGameSounds();
  }, []);
  const rules = useMemo(
    () => [
      t("settings.rule1"),
      t("settings.rule2"),
      t("settings.rule3"),
      t("settings.rule4"),
    ],
    [t],
  );

  const createRoomMutation = useMutation<CreatedRoom, Error>({
    mutationFn: () => createRoom(),
    onSuccess: (result) => {
      saveRoomAuth(result.roomId, {
        playerId: result.playerId,
        playerToken: result.playerToken,
      });
      void navigate({
        to: "/online/$roomId",
        params: { roomId: result.roomId },
      });
    },
  });

  const normalizedRoomId = useMemo(
    () => normalizeRoomIdInput(joinRoomInput),
    [joinRoomInput],
  );
  const canJoin = ROOM_ID_PATTERN.test(normalizedRoomId);

  const handleJoin = (): void => {
    if (!canJoin) {
      return;
    }

    void navigate({
      to: "/online/$roomId",
      params: { roomId: normalizedRoomId },
    });
  };

  return (
    <main className="min-h-dvh w-full p-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-36">
        <AppHeader showBrand={false} rules={rules} />

        <div className="flex flex-col gap-4 py-2 sm:py-4">
          <section className="space-y-2 px-2 text-center">
            <h1 className="font-display text-4xl font-bold tracking-tight text-(--text-strong) sm:text-5xl">
              {t("title.heading")}
            </h1>
            <p className="text-sm text-(--text-muted) sm:text-base">
              {t("title.subtitle")}
            </p>
          </section>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end gap-2">
                <CardTitle>{t("common.local")}</CardTitle>
                <CardDescription className="text-[11px] leading-none sm:text-xs">
                  {t("title.localDescription")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                variant="local"
                onClick={() => {
                  void navigate({ to: "/local" });
                }}
              >
                {t("title.localStart")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end gap-2">
                <CardTitle>{t("common.online")}</CardTitle>
                <CardDescription className="text-[11px] leading-none sm:text-xs">
                  {t("title.onlineDescription")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                type="button"
                className="w-full"
                variant="create"
                onClick={() => {
                  createRoomMutation.mutate();
                }}
                disabled={createRoomMutation.isPending}
              >
                {createRoomMutation.isPending
                  ? t("status.connecting")
                  : t("title.createRoom")}
              </Button>

              <div className="flex gap-2">
                <Input
                  value={normalizedRoomId}
                  onChange={(event) => setJoinRoomInput(event.target.value)}
                  placeholder={t("title.roomInputPlaceholder")}
                  className="uppercase"
                  inputMode="text"
                />
                <Button
                  type="button"
                  onClick={handleJoin}
                  disabled={!canJoin}
                  variant={canJoin ? "join" : "secondary"}
                >
                  {t("title.joinRoom")}
                </Button>
              </div>

              {!canJoin && normalizedRoomId.length > 0 ? (
                <p className="text-xs text-(--accent-gold-1)">
                  {t("game.invalidRoomId")}
                </p>
              ) : null}

              {createRoomMutation.error ? (
                <p className="text-xs text-(--accent-crimson-1)">
                  {createRoomMutation.error.message}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
