import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { validateDiscoverSearch } from "./discoverSearch";

function validateLibrarySearch(search: Record<string, unknown>) {
  const rawPage = typeof search.page === "number" ? search.page : Number(search.page);
  return {
    q: typeof search.q === "string" ? search.q : "",
    id: typeof search.id === "string" ? search.id : "",
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
  };
}

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/library", search: { q: "", id: "", page: 1 } });
  },
});

const discoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/discover",
  validateSearch: validateDiscoverSearch,
  component: lazyRouteComponent(() => import("./screens/Discover"), "Discover"),
});

const discoverDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/discover/$sourceId",
  validateSearch: validateDiscoverSearch,
  component: lazyRouteComponent(() => import("./screens/DiscoverDetail"), "DiscoverDetail"),
});

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/queue",
  component: lazyRouteComponent(() => import("./screens/Queue"), "Queue"),
});

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  validateSearch: validateLibrarySearch,
  component: lazyRouteComponent(() => import("./screens/Library"), "Library"),
});

const onlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/online",
  component: lazyRouteComponent(() => import("./screens/Online"), "Online"),
});

const transferRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/transfer",
  component: lazyRouteComponent(() => import("./screens/Transfer"), "Transfer"),
});

const syncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sync",
  component: lazyRouteComponent(() => import("./screens/Sync"), "Sync"),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("./screens/Settings"), "Settings"),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  discoverRoute,
  discoverDetailRoute,
  queueRoute,
  libraryRoute,
  onlineRoute,
  transferRoute,
  syncRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingMs: 0,
  defaultPendingMinMs: 120,
  defaultPendingComponent: () => (
    <div className="buffering-line flex min-h-40 items-center justify-center p-5 text-sm text-[color:var(--text-body)]" role="status">
      正在加载页面...
    </div>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
