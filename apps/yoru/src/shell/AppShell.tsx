import { useEffect, useRef } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Books,
  Compass,
  DownloadSimple,
  GearSix,
  GlobeHemisphereEast,
  type Icon,
} from "@phosphor-icons/react";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { ExpandedPlayer, PlayerBar } from "@/player";

type NavTo = "/online" | "/discover" | "/library" | "/transfer" | "/settings";

const navItems: Array<{ to: NavTo; label: string; kana: string; Icon: Icon }> = [
  { to: "/online", label: "在线", kana: "おんらいん", Icon: GlobeHemisphereEast },
  { to: "/discover", label: "发现", kana: "たんさく", Icon: Compass },
  { to: "/library", label: "媒体库", kana: "らいぶらり", Icon: Books },
  { to: "/transfer", label: "传输", kana: "てんそう", Icon: DownloadSimple },
  { to: "/settings", label: "设置", kana: "せってい", Icon: GearSix },
];

function isNavActive(pathname: string, to: NavTo) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * 应用壳(原型 dc.html:30-52):
 * 桌面 header = logo + 胶囊 nav(假名小字 + 传输徽章)+ 健康灯 + 主题钮;
 * 移动(<768px)= 精简 header + 底部 56px 毛玻璃 tab bar。
 */
export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { resolvedTheme, update } = useSettings();

  const summaryQuery = useQuery({
    queryKey: keys.tasks.summary,
    queryFn: () => apiClient.getTaskSummary(),
    refetchInterval: 15_000,
  });
  const summary = summaryQuery.data;
  const pendingCount = (summary?.queued ?? 0) + (summary?.running ?? 0);

  const healthQuery = useQuery({
    queryKey: keys.health,
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30_000,
    retry: 1,
  });
  const offline = healthQuery.isError;

  // 进入离线状态时 toast 一次(恢复在线后再掉线会再提示)
  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (offline && !wasOfflineRef.current) {
      toast.error("本地服务离线,搜索、同步和任务操作暂不可用");
    }
    wasOfflineRef.current = offline;
  }, [offline]);

  const cycleTheme = () => {
    update({ theme: resolvedTheme === "dark" ? "light" : "dark" });
  };

  return (
    <div className="y-shell">
      <header className="y-shell-header">
        <Link to="/library" className="y-shell-logo" aria-label="ASMRoner 首页">
          <div className="y-shell-logo__title">ASMRoner</div>
          <div className="y-shell-logo__sub">よる · 夜间电台</div>
        </Link>
        <nav className="y-nav" aria-label="主导航">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn("y-nav__item", active && "is-on")}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                <span className="y-nav__kana">{item.kana}</span>
                {item.to === "/transfer" && pendingCount > 0 && (
                  <span className="y-nav__badge">{pendingCount}件</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="y-shell-right">
          <span
            className={cn("y-health", offline && "is-off")}
            role="status"
            title={offline ? "本地服务离线" : "本地服务在线"}
          >
            <span className="y-health__dot" aria-hidden="true" />
            {offline ? "离线" : "本地服务在线"}
            <span className="y-health__port">:8080</span>
          </span>
          <button
            type="button"
            className="y-theme-btn"
            onClick={cycleTheme}
            aria-label={resolvedTheme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
          >
            {resolvedTheme === "dark" ? "☾" : "☀"}
          </button>
        </div>
      </header>

      <main className="y-shell-main">
        <Outlet />
      </main>

      <PlayerBar />
      <ExpandedPlayer />

      <nav className="y-tabbar" aria-label="主导航(移动端)">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn("y-tabbar__item", active && "is-on")}
              aria-current={active ? "page" : undefined}
            >
              <item.Icon size={20} weight={active ? "fill" : "regular"} />
              <span>{item.label}</span>
              {item.to === "/transfer" && pendingCount > 0 && (
                <span className="y-tabbar__badge">{pendingCount}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
