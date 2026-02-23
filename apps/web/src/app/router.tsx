import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { GamePage } from "@/features/game/components/game-page";
import { useLocalGameSession } from "@/features/game/hooks/use-local-game-session";
import { useOnlineGameSession } from "@/features/game/hooks/use-online-game-session";
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

const onlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/online/$roomId",
  component: OnlineGameRouteComponent,
});

const routeTree = rootRoute.addChildren([titleRoute, localRoute, onlineRoute]);

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
