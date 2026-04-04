import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Compass,
  FolderOpen,
  Gauge,
  ListTodo,
  RefreshCcw,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NavTo =
  | "/"
  | "/discover"
  | "/queue"
  | "/library"
  | "/sync"
  | "/settings";

const navItems = [
  { to: "/", label: "总览", icon: Gauge },
  { to: "/discover", label: "发现", icon: Compass },
  { to: "/queue", label: "任务", icon: ListTodo },
  { to: "/library", label: "媒体库", icon: FolderOpen },
  { to: "/sync", label: "同步", icon: RefreshCcw },
  { to: "/settings", label: "设置", icon: Settings },
] satisfies Array<{ to: NavTo; label: string; icon: typeof Gauge }>;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
      <aside className="w-full border-b border-white/10 bg-slate-900/50 px-5 py-4 backdrop-blur-xl lg:w-72 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
        <div className="flex items-center justify-between lg:block">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
              控制台
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              ASMRoner
            </h1>
          </div>
          <Badge className="bg-amber-500/15 text-amber-200 border-amber-500/30">
            测试版
          </Badge>
        </div>
        <p className="mt-4 hidden text-sm leading-6 text-slate-400 lg:block">
          搜索作品、加入下载任务、管理本地媒体库，并控制同步流程。
        </p>
        <nav className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white",
                )}
                activeProps={{
                  className:
                    "border-amber-500/30 bg-amber-500/10 text-white shadow-[0_0_0_1px_rgba(245,158,11,0.15)]",
                }}
              >
                <Icon className="h-4 w-4 text-amber-300 transition group-hover:scale-110" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
