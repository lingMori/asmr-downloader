import {
  Desktop,
  ListChecks,
  Moon,
  SidebarSimple,
  Sun,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ThemeMode = "light" | "dark" | "system";
type ServiceState = "online" | "checking" | "offline";

export function DeckStatusBar({
  activeLabel,
  activeHint,
  serviceState,
  sidebarCollapsed,
  onToggleSidebar,
  themeMode,
  onThemeModeChange,
  activeTaskCount,
  onOpenTasks,
}: {
  activeLabel: string;
  activeHint: string;
  serviceState: ServiceState;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  activeTaskCount: number;
  onOpenTasks: () => void;
}) {
  return (
    <div className="deck-chassis status-bar p-2">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden w-10 px-0 lg:inline-flex"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <SidebarSimple className="h-4 w-4" weight="regular" />
          </Button>
          <div className="min-w-0">
            <div className="console-title truncate text-base font-bold text-[color:var(--text-display)]">
              {activeLabel}
            </div>
            <div className="mt-0.5 hidden truncate text-xs text-[color:var(--text-mute)] sm:block">
              {activeHint}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={serviceBadgeVariant(serviceState)}>
            {serviceBadgeLabel(serviceState)}
          </Badge>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onOpenTasks}
            aria-label={`进行中的任务 ${activeTaskCount}`}
          >
            <ListChecks className="h-4 w-4" weight="duotone" />
            <span className="hidden sm:inline">进行中</span>
            <span className="console-mono">{activeTaskCount}</span>
          </Button>
          <ThemeSwitch value={themeMode} onChange={onThemeModeChange} />
        </div>
      </div>
    </div>
  );
}

function serviceBadgeVariant(state: ServiceState): "halt" | "warn" | "signal" {
  if (state === "offline") return "halt";
  if (state === "checking") return "warn";
  return "signal";
}

function serviceBadgeLabel(state: ServiceState) {
  if (state === "offline") return "API 离线";
  if (state === "checking") return "API 检查中";
  return "API 可用";
}

function ThemeSwitch({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const options = [
    { value: "dark" as const, label: "深色", icon: Moon },
    { value: "light" as const, label: "浅色", icon: Sun },
    { value: "system" as const, label: "跟随系统", icon: Desktop },
  ] satisfies Array<{ value: ThemeMode; label: string; icon: Icon }>;

  return (
    <div className="theme-segmented" role="group" aria-label="主题模式">
      {options.map((option) => {
        const IconComponent = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={value === option.value}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <IconComponent className="h-4 w-4" weight={value === option.value ? "fill" : "regular"} />
          </button>
        );
      })}
    </div>
  );
}
