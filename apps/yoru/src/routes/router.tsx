import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  redirect,
} from "@tanstack/react-router";
import { EmptyState, Skeleton } from "@/components/ui";
import { TaskRealtimeBridge } from "@/components/TaskRealtimeBridge";
import { SettingsProvider } from "@/lib/settings";
import { GlobalPlayerProvider } from "@/player";
import { AppShell } from "@/shell/AppShell";
import StyleLab from "./screens/StyleLab";

function RootComponent() {
  return (
    <SettingsProvider>
      <TaskRealtimeBridge />
      <GlobalPlayerProvider>
        <AppShell />
      </GlobalPlayerProvider>
    </SettingsProvider>
  );
}

function NotFound() {
  return (
    <div className="y-page">
      <EmptyState
        icon="404"
        action={
          <Link to="/library" className="y-btn-ghost">
            回媒体库
          </Link>
        }
      >
        ページが見つかりません · 页面不存在
      </EmptyState>
    </div>
  );
}

function RoutePending() {
  return (
    <div className="y-page" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton variant="row" count={3} />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/library" });
  },
});

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  component: lazyRouteComponent(() => import("./screens/Library"), "LibraryScreen"),
});

const discoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/discover",
  component: lazyRouteComponent(() => import("./screens/Discover"), "DiscoverScreen"),
});

const workDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/works/$sourceId",
  component: lazyRouteComponent(() => import("./screens/WorkDetail"), "WorkDetailScreen"),
});

const onlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/online",
  component: lazyRouteComponent(() => import("./screens/Online"), "OnlineScreen"),
});

const transferRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/transfer",
  component: lazyRouteComponent(() => import("./screens/Transfer"), "TransferScreen"),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("./screens/Settings"), "SettingsScreen"),
});

// Phase 0 设计系统自检页,保留至各真实页面落地后可删
const styleLabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stylelab",
  component: StyleLab,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  libraryRoute,
  discoverRoute,
  workDetailRoute,
  onlineRoute,
  transferRoute,
  settingsRoute,
  styleLabRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPendingComponent: RoutePending,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
