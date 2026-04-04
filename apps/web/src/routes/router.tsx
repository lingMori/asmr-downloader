import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { validateDiscoverSearch } from "./discoverSearch";
import { Dashboard } from "./screens/Dashboard";
import { Discover } from "./screens/Discover";
import { DiscoverDetail } from "./screens/DiscoverDetail";
import { Library } from "./screens/Library";
import { Queue } from "./screens/Queue";
import { Settings } from "./screens/Settings";
import { Sync } from "./screens/Sync";

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

const discoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/discover",
  validateSearch: validateDiscoverSearch,
  component: Discover,
});

const discoverDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/discover/$sourceId",
  validateSearch: validateDiscoverSearch,
  component: DiscoverDetail,
});

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/queue",
  component: Queue,
});

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  component: Library,
});

const syncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sync",
  component: Sync,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  discoverRoute,
  discoverDetailRoute,
  queueRoute,
  libraryRoute,
  syncRoute,
  settingsRoute,
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
