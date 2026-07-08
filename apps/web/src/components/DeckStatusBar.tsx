import { useEffect, useMemo, useState } from "react";
import { SidebarSimple, TerminalWindow } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";
type ServiceState = "online" | "checking" | "offline";

export function DeckStatusBar({
  activeCode,
  activeLabel,
  activeHint,
  packetCount,
  serviceState,
  sidebarCollapsed,
  onToggleSidebar,
  themeMode,
  onThemeModeChange,
}: {
  activeCode: string;
  activeLabel: string;
  activeHint: string;
  packetCount: number;
  serviceState: ServiceState;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const packetLabel = useMemo(() => String(packetCount).padStart(3, "0"), [packetCount]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
            className="hidden h-8 w-8 px-0 lg:inline-flex"
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
              <span className="deck-decal hidden md:inline-flex">MODULE {activeCode}</span>
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
          <Badge variant={packetCount > 0 ? "signal" : "mute"}>SSE {packetCount > 0 ? "RX" : "IDLE"}</Badge>
          <Badge variant="mute" className="hidden md:inline-flex">PKT {packetLabel}</Badge>
        </div>
      </div>
      <div className="mt-1.5 hidden items-center justify-between gap-3 border-t border-[color:var(--chassis-edge)] pt-1.5 md:flex">
        <div className="console-mono flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-mute)]">
          <span>TRACE / {activeCode}</span>
          <span className="max-w-[26rem] truncate">{activeHint}</span>
          <span>{formatClock(now)}</span>
        </div>
        <ThemeSwitch value={themeMode} onChange={onThemeModeChange} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 md:hidden">
        <span className="console-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-mute)]">
          PKT {packetLabel}
        </span>
        <ThemeSwitch value={themeMode} onChange={onThemeModeChange} compact />
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

function formatClock(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
}

function ThemeSwitch({
  value,
  onChange,
  compact = false,
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  compact?: boolean;
}) {
  const options = [
    { value: "dark" as const, label: "CRT" },
    { value: "light" as const, label: "PANEL" },
    { value: "system" as const, label: "AUTO" },
  ];
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const slotWidth = compact ? 47 : 50;
  const offset = compact ? 11 : 12;

  return (
    <div
      className={cn("deck-plate relative h-7 p-1", compact ? "w-[146px]" : "w-[146px]")}
      role="group"
      aria-label="主题模式"
    >
      <div className="absolute inset-x-3 top-1/2 h-px bg-[color:var(--chassis-edge)]" />
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 border border-[color:var(--telltale-amber)] bg-[color:var(--chassis-raise)] shadow-[var(--glow-amber)] transition-[left] duration-[30ms] ease-linear"
        style={{ left: `${offset + activeIndex * slotWidth}px` }}
      />
      <div className="relative z-10 grid grid-cols-3 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "h-5 text-[11px] font-semibold transition",
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
