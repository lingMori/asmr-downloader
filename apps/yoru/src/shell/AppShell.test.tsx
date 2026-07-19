import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { HealthResponse, TaskSummary } from "@/lib/api";
import { SettingsProvider } from "@/lib/settings";
import { GlobalPlayerProvider } from "@/player";
import { AppShell } from "./AppShell";

vi.mock("@/lib/api", () => ({
  apiClient: {
    getHealth: vi.fn(),
    getTaskSummary: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api";

const mockedHealth = vi.mocked(apiClient.getHealth);
const mockedSummary = vi.mocked(apiClient.getTaskSummary);

const HEALTH: HealthResponse = { status: "ok", version: "0.0.0", time: "" };
const SUMMARY: TaskSummary = {
  total: 9,
  queued: 2,
  running: 1,
  success: 5,
  failed: 1,
  canceled: 0,
  terminated: 0,
};

function renderShell(initialPath = "/library") {
  const rootRoute = createRootRoute({
    component: () => (
      <SettingsProvider>
        <GlobalPlayerProvider>
          <AppShell />
        </GlobalPlayerProvider>
      </SettingsProvider>
    ),
  });
  const stub = (path: string) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <div>page {path}</div>,
    });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      stub("/online"),
      stub("/discover"),
      stub("/library"),
      stub("/transfer"),
      stub("/settings"),
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedHealth.mockResolvedValue(HEALTH);
    mockedSummary.mockResolvedValue(SUMMARY);
  });

  it("渲染 5 项胶囊 nav(中文 + 假名),当前页 is-on", async () => {
    renderShell("/library");
    const libraryLink = await screen.findAllByRole("link", { name: /媒体库 らいぶらり/ });
    expect(libraryLink.length).toBeGreaterThan(0);
    for (const label of ["在线 おんらいん", "发现 たんさく", "传输 てんそう", "设置 せってい"]) {
      expect(screen.getAllByRole("link", { name: new RegExp(label) }).length).toBeGreaterThan(0);
    }
    expect(libraryLink[0]).toHaveClass("is-on");
  });

  it("传输徽章 = queued+running,健康灯在线", async () => {
    renderShell("/discover");
    expect(await screen.findByText("3件")).toBeInTheDocument();
    expect(await screen.findByText("本地服务在线")).toBeInTheDocument();
  });

  it("健康灯离线时显示「离线」", async () => {
    mockedHealth.mockRejectedValue(new Error("down"));
    renderShell();
    expect(await screen.findByText("离线", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("主题钮 dark↔light 循环并写 dataset", async () => {
    renderShell();
    const btn = (await screen.findAllByRole("button", { name: "切换到亮色主题" }))[0];
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
