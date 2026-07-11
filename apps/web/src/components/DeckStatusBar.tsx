import { ListChecks, SidebarSimple, TerminalWindow } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div
      className="deck-chassis z-20 mb-2 p-2 lg:sticky lg:top-3"
      data-live={serviceState === "online" ? "soft" : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="hidden h-11 w-11 px-0 lg:inline-flex"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <SidebarSimple className="h-4 w-4" weight="duotone" />
          </Button>
          <div className="deck-screen flex h-7 w-7 shrink-0 items-center justify-center text-[color:var(--phosphor-primary)]">
            <TerminalWindow className="h-4 w-4" weight="duotone" />
          </div>
          <div className="min-w-0 leading-none">
            <div className="flex min-w-0 items-center gap-2">
              <span className="console-title truncate text-lg font-black text-[color:var(--text-display)]">
                {activeLabel}
              </span>
            </div>
            <div className="mt-1 hidden truncate text-xs text-[color:var(--text-mute)] sm:block">
              {activeHint}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={serviceBadgeVariant(serviceState)}>
            {serviceBadgeLabel(serviceState)}
          </Badge>
          <Button type="button" variant="secondary" size="sm" className="h-11" onClick={onOpenTasks}>
            <ListChecks className="h-4 w-4" weight="duotone" />
            进行中 {activeTaskCount}
          </Button>
          <ThemeSwitch value={themeMode} onChange={onThemeModeChange} />
        </div>
      </div>
    </div>
  );
}

function serviceBadgeVariant(state: ServiceState): "halt" | "warn" | "signal" {
  if (state === "offline") {
    return "halt";
  }
  if (state === "checking") {
    return "warn";
  }
  return "signal";
}

function serviceBadgeLabel(state: ServiceState) {
  if (state === "offline") {
    return "API OFF";
  }
  if (state === "checking") {
    return "API CHECK";
  }
  return "API OK";
}

function ThemeSwitch({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const options = [
    { value: "dark" as const, label: "CRT" },
    { value: "light" as const, label: "PANEL" },
    { value: "system" as const, label: "AUTO" },
  ];
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const slotWidth = 50;
  const offset = 12;

  return (
    <div
      className="deck-plate relative h-[52px] w-[146px] p-1"
      role="group"
      aria-label="主题模式"
    >
      <div className="absolute inset-x-3 top-1/2 h-px bg-[color:var(--chassis-edge)]" />
      <div
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 border border-[color:var(--telltale-amber)] bg-[color:var(--chassis-raise)] shadow-[var(--glow-amber)] transition-[left] duration-[30ms] ease-linear"
        style={{ left: `${offset + activeIndex * slotWidth}px` }}
      />
      <div className="relative z-10 grid grid-cols-3 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "h-11 text-[11px] font-semibold transition",
              value === option.value
                ? "text-[color:var(--telltale-amber)]"
                : "text-[color:var(--text-mute)] hover:text-[color:var(--text-body)]",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
