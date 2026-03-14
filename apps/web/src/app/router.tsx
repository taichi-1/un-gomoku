import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { GamePage } from "@/features/game/components/game-page";
import { useCpuGameSession } from "@/features/game/hooks/use-cpu-game-session";
import { useLocalGameSession } from "@/features/game/hooks/use-local-game-session";
import { useOnlineGameSession } from "@/features/game/hooks/use-online-game-session";
import type {
  CpuDifficulty,
  CpuPersona,
  CpuTurnOrder,
} from "@/features/game/lib/cpu";
import { TitlePage } from "@/features/title/components/title-page";

function RootLayout() {
  return (
    <div className="relative min-h-dvh w-full text-(--text-strong)">
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
    </div>
  );
}

function LocalGameRouteComponent() {
  const controller = useLocalGameSession();
  return <GamePage controller={controller} />;
}

const VALID_DIFFICULTIES = new Set<string>(["easy", "medium", "hard"]);
const VALID_TURN_ORDERS = new Set<string>(["first", "second", "random"]);
const VALID_PERSONAS = new Set<string>(["attacker", "defender", "gambler"]);

function CpuGameRouteComponent() {
  const { difficulty, turnOrder, persona } = cpuRoute.useSearch();
  const controller = useCpuGameSession(difficulty, turnOrder, persona);
  return <GamePage controller={controller} />;
}

function OnlineGameRouteComponent() {
  const { roomId } = onlineRoute.useParams();
  const controller = useOnlineGameSession(roomId);
  return <GamePage controller={controller} />;
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const titleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TitlePage,
});

const localRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/local",
  component: LocalGameRouteComponent,
});

const cpuRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cpu",
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    difficulty: CpuDifficulty;
    turnOrder: CpuTurnOrder;
    persona: CpuPersona;
  } => {
    const d = String(search.difficulty ?? "medium");
    const t = String(search.turnOrder ?? "random");
    const rawPersona = String(search.persona ?? "");
    const legacyStyle = String(search.style ?? "");
    const legacyRisk = String(search.risk ?? "");
    const fallbackPersona =
      legacyRisk === "bold"
        ? "gambler"
        : legacyStyle === "guard"
          ? "defender"
          : legacyStyle === "rush"
            ? "attacker"
            : "attacker";
    return {
      difficulty: VALID_DIFFICULTIES.has(d) ? (d as CpuDifficulty) : "medium",
      turnOrder: VALID_TURN_ORDERS.has(t) ? (t as CpuTurnOrder) : "random",
      persona: VALID_PERSONAS.has(rawPersona)
        ? (rawPersona as CpuPersona)
        : (fallbackPersona as CpuPersona),
    };
  },
  component: CpuGameRouteComponent,
});

const onlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/online/$roomId",
  component: OnlineGameRouteComponent,
});

const routeTree = rootRoute.addChildren([
  titleRoute,
  localRoute,
  cpuRoute,
  onlineRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
