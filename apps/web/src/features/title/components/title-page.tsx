import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Shuffle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CpuArchetype,
  CpuDifficulty,
  CpuTurnOrder,
} from "@/features/game/lib/cpu";
import { preloadAllGameSounds } from "@/features/game/sound/game-sound-player";
import { type CreatedRoom, createRoom } from "@/features/title/lib/create-room";
import { saveRoomAuth } from "@/lib/room-auth-storage";

const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;
const CPU_DIFFICULTY_OPTIONS: readonly CpuDifficulty[] = [
  "easy",
  "medium",
  "hard",
];
const CPU_TURN_ORDER_OPTIONS: readonly CpuTurnOrder[] = [
  "first",
  "second",
  "random",
];
const CPU_ARCHETYPE_OPTIONS: readonly CpuArchetype[] = ["attacker", "guardian", "gambler"];

function pickRandom<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] as T;
}

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
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>("medium");
  const [cpuArchetype, setCpuArchetype] = useState<CpuArchetype>("guardian");
  const [cpuTurnOrder, setCpuTurnOrder] = useState<CpuTurnOrder>("random");
  const [isCpuSettingsOpen, setIsCpuSettingsOpen] = useState(false);

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

  const randomizeCpuSettings = (): void => {
    setCpuDifficulty(pickRandom(CPU_DIFFICULTY_OPTIONS));
    setCpuTurnOrder(pickRandom(CPU_TURN_ORDER_OPTIONS));
    setCpuArchetype(pickRandom(CPU_ARCHETYPE_OPTIONS));
  };

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
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <AppHeader showBrand={false} rules={rules} />

        {/* Keep title content offset responsive; avoid fixed large top gaps on small screens. */}
        <div className="flex flex-col gap-3 pt-[clamp(0.25rem,3vh,1.5rem)] pb-2 sm:gap-4 sm:pt-[clamp(1.5rem,12vh,9rem)] sm:pb-4">
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

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-end gap-2">
                  <CardTitle>{t("title.cpuTitle")}</CardTitle>
                  <CardDescription className="text-[11px] leading-none sm:text-xs">
                    {t("title.cpuDescription")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={
                      isCpuSettingsOpen
                        ? t("title.cpuSettingsCollapse")
                        : t("title.cpuSettingsExpand")
                    }
                    title={
                      isCpuSettingsOpen
                        ? t("title.cpuSettingsCollapse")
                        : t("title.cpuSettingsExpand")
                    }
                    aria-expanded={isCpuSettingsOpen}
                    onClick={() => setIsCpuSettingsOpen((prev) => !prev)}
                    className="h-8 w-8 shrink-0 rounded-sm p-0 hover:bg-transparent"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isCpuSettingsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t("title.cpuRandomize")}
                    title={t("title.cpuRandomize")}
                    onClick={randomizeCpuSettings}
                    className="h-8 w-8 shrink-0 rounded-sm p-0 hover:bg-transparent"
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {isCpuSettingsOpen ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-(--text-muted)">
                      {t("title.cpuDifficultyLabel")}
                    </span>
                    <Select
                      value={cpuDifficulty}
                      onValueChange={(v) =>
                        setCpuDifficulty(v as CpuDifficulty)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">
                          {t("title.cpuDifficulty.easy")}
                        </SelectItem>
                        <SelectItem value="medium">
                          {t("title.cpuDifficulty.medium")}
                        </SelectItem>
                        <SelectItem value="hard">
                          {t("title.cpuDifficulty.hard")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-(--text-muted)">
                      {t("title.cpuTurnOrderLabel")}
                    </span>
                    <Select
                      value={cpuTurnOrder}
                      onValueChange={(v) => setCpuTurnOrder(v as CpuTurnOrder)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">
                          {t("title.cpuTurnOrder.random")}
                        </SelectItem>
                        <SelectItem value="first">
                          {t("title.cpuTurnOrder.first")}
                        </SelectItem>
                        <SelectItem value="second">
                          {t("title.cpuTurnOrder.second")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-(--text-muted)">
                      {t("title.cpuArchetypeLabel")}
                    </span>
                    <Select
                      value={cpuArchetype}
                      onValueChange={(v) => setCpuArchetype(v as CpuArchetype)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attacker">
                          {t("title.cpuArchetype.attacker")}
                        </SelectItem>
                        <SelectItem value="guardian">
                          {t("title.cpuArchetype.guardian")}
                        </SelectItem>
                        <SelectItem value="gambler">
                          {t("title.cpuArchetype.gambler")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
              <Button
                type="button"
                className="w-full"
                variant="local"
                onClick={() => {
                  void navigate({
                    to: "/cpu",
                    search: {
                      difficulty: cpuDifficulty,
                      archetype: cpuArchetype,
                      turnOrder: cpuTurnOrder,
                    },
                  });
                }}
              >
                {t("title.cpuStart")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
