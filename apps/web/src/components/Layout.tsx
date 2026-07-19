import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Desktop, ListChecks, Moon, Sun } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeckDialog } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";

type NavTo = "/library" | "/discover" | "/online" | "/transfer" | "/settings";

const navItems = [
  { to: "/library", label: "媒体库", kana: "らいぶらり" },
  { to: "/discover", label: "发现", kana: "たんさく" },
  { to: "/online", label: "在线", kana: "おんらいん" },
  { to: "/transfer", label: "传输", kana: "でんそう" },
  { to: "/settings", label: "设置", kana: "せってい" },
] satisfies Array<{
  to: NavTo;
  label: string;
  kana: string;
}>;

type ThemeMode = "light" | "dark" | "system";
type ServiceState = "online" | "checking" | "offline";

const THEME_STORAGE_KEY = "asmroner-command-theme";
/** Retired sidebar preference from the previous console layout; cleaned up on boot. */
const LEGACY_SIDEBAR_STORAGE_KEY = "asmroner-command-sidebar-collapsed";

const nextThemeMode: Record<ThemeMode, ThemeMode> = {
  dark: "light",
  light: "system",
  system: "dark",
};

const themeModeMeta: Record<ThemeMode, { label: string; icon: Icon }> = {
  dark: { label: "深色", icon: Moon },
  light: { label: "浅色", icon: Sun },
  system: { label: "跟随系统", icon: Desktop },
};

export function Layout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeNav = resolveNav(pathname);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode());
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);

  const healthQuery = useQuery({
    queryKey: ["system", "health"],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30000,
    retry: 1,
  });
  const serviceState: ServiceState = healthQuery.isError
    ? "offline"
    : healthQuery.data
      ? "online"
      : "checking";

  const activeTasksQuery = useQuery({
    queryKey: ["tasks", "global-active"],
    queryFn: () => apiClient.getTasks({ status: ["QUEUED", "RUNNING"], pageSize: 50 }),
    refetchInterval: 15000,
  });
  const activeTasks = activeTasksQuery.data?.items ?? [];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolved = themeMode === "system"
        ? (mediaQuery.matches ? "dark" : "light")
        : themeMode;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themeMode = themeMode;
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    };

    applyTheme();
    const handleSystemThemeChange = () => {
      if (themeMode === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_SIDEBAR_STORAGE_KEY);
  }, []);

  const ThemeIcon = themeModeMeta[themeMode].icon;

  return (
    <div className="console-shell">
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[140] border border-[color:var(--accent)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm font-semibold text-[color:var(--text-display)] focus:not-sr-only"
      >
        跳到主要内容
      </a>

      <header className="app-header">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-6">
          <Link to="/library" search={{ q: "", id: "", page: 1 }} className="flex items-center gap-2.5 justify-self-start" aria-label="ASMRoner 首页">
            <div className="mascot-avatar" aria-hidden="true" />
            <div className="leading-tight">
              <div className="console-title text-[17px] font-black text-[color:var(--text-display)]">
                ASMRoner
              </div>
              <div className="mt-0.5 text-[9.5px] text-[color:var(--text-mute)]">
                よる · 夜间电台
              </div>
            </div>
          </Link>

          <nav
            className="pill-nav order-3 w-full justify-self-center overflow-x-auto lg:order-none lg:w-auto"
            aria-label="主导航"
          >
            {navItems.map((item) => (
              <PillNavLink
                key={item.to}
                item={item}
                active={activeNav.to === item.to}
                badgeCount={item.to === "/transfer" ? activeTasks.length : 0}
              />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5 justify-self-end lg:ml-0">
            <span className="service-light hidden sm:inline-flex" data-state={serviceState}>
              <span className="service-light-dot" aria-hidden="true" />
              {serviceState === "online"
                ? "本地服务在线"
                : serviceState === "checking"
                  ? "连接中…"
                  : "服务离线"}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setTaskPanelOpen(true)}
              aria-label={`进行中的任务 ${activeTasks.length}`}
            >
              <ListChecks className="h-4 w-4" weight="duotone" />
              <span className="hidden sm:inline">进行中</span>
              <span className="console-mono">{activeTasks.length}</span>
            </Button>
            <button
              type="button"
              className="theme-cycle"
              onClick={() => setThemeMode(nextThemeMode[themeMode])}
              aria-label={`主题：${themeModeMeta[themeMode].label}，点击切换`}
              title={`主题：${themeModeMeta[themeMode].label}`}
            >
              <ThemeIcon className="h-4 w-4" weight={themeMode === "system" ? "regular" : "fill"} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1420px] px-3 py-4 lg:px-4">
        {serviceState === "offline" ? (
          <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[color:var(--telltale-red)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--text-body)]">
            <span>本地 API 无法连接。搜索、同步和任务操作暂不可用。</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void healthQuery.refetch()}>
                重新连接
              </Button>
              <Link to="/settings" className="deck-button-secondary inline-flex min-h-9 items-center border px-3 text-xs font-semibold">
                检查设置
              </Link>
            </div>
          </div>
        ) : null}

        <main id="main-content" tabIndex={-1} className="crt-route">
          {children}
        </main>
      </div>

      <DeckDialog
        open={taskPanelOpen}
        onOpenChange={setTaskPanelOpen}
        kicker="任务"
        title="进行中的任务"
        description="所有排队和执行中的后台任务。"
        tone={activeTasks.length > 0 ? "signal" : "mute"}
        footer={
          <Link
            to="/queue"
            onClick={() => setTaskPanelOpen(false)}
            className="deck-button-secondary inline-flex min-h-10 items-center border px-4 text-xs font-semibold"
          >
            打开任务中心
          </Link>
        }
      >
        <div className="divide-y divide-[color:var(--border-subtle)] border-y border-[color:var(--border)]">
          {activeTasks.map((task) => (
            <Link
              key={task.id}
              to="/queue"
              onClick={() => setTaskPanelOpen(false)}
              className="grid gap-2 py-3 transition-colors hover:bg-[color:var(--interactive-bg)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-2"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-[color:var(--text-display)]">{task.name}</div>
                <div className="mt-1 flex min-w-0 gap-2 text-xs text-[color:var(--text-mute)]">
                  <span className="console-mono shrink-0">#{task.id}</span>
                  <span className="truncate">{task.message || "等待后台更新"}</span>
                </div>
              </div>
              <Badge variant={task.status === "RUNNING" ? "live" : "warn"}>
                {task.status === "RUNNING" ? "执行中" : "排队中"}
              </Badge>
            </Link>
          ))}
          {activeTasks.length === 0 ? (
            <div className="py-8 text-sm text-[color:var(--text-body)]">
              当前没有排队或执行中的任务。
            </div>
          ) : null}
        </div>
      </DeckDialog>
    </div>
  );
}

function PillNavLink({
  item,
  active,
  badgeCount,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  badgeCount: number;
}) {
  return (
    <Link
      to={item.to}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className="pill-nav-link"
      data-active={active ? "true" : undefined}
    >
      <span>{item.label}</span>
      <span className="pill-nav-kana">{item.kana}</span>
      {badgeCount > 0 ? (
        <span className="sticker pill-nav-badge" data-angle="3">
          {badgeCount}件
        </span>
      ) : null}
    </Link>
  );
}

function resolveNav(pathname: string) {
  if (pathname.startsWith("/discover")) return navItems[1];
  if (pathname.startsWith("/online")) return navItems[2];
  if (pathname.startsWith("/transfer")) return navItems[3];
  if (pathname.startsWith("/queue") || pathname.startsWith("/sync")) return navItems[3];
  if (pathname.startsWith("/settings")) return navItems[4];
  return navItems[0];
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "system";
}
