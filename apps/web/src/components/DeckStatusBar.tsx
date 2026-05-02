import { useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, SidebarSimple, TerminalWindow } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";

export function DeckStatusBar({
  activeLabel,
  activeCode,
  activeHint,
  packetCount,
  sidebarCollapsed,
  onToggleSidebar,
  themeMode,
  onThemeModeChange,
}: {
  activeLabel: string;
  activeCode: string;
  activeHint: string;
  packetCount: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const utc = useUtcTimecode();
  const [pinging, setPinging] = useState(false);
  const packetStub = useMemo(
    () => (packetCount % 32).toString(2).padStart(5, "0"),
    [packetCount],
  );

  function triggerPing() {
    setPinging(true);
    window.setTimeout(() => setPinging(false), 1100);
  }

  return (
    <div className="deck-chassis sticky top-3 z-20 mb-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--chassis-edge)] pb-3">
        <div className="flex min-w-0 items-center gap-3">
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
          <span className="deck-plate flex h-9 w-9 items-center justify-center text-[color:var(--phosphor-primary)]">
            <TerminalWindow className="h-4 w-4" weight="duotone" />
          </span>
          <div className="min-w-0">
            <div className="console-title truncate text-lg font-black text-[color:var(--text-display)]">
              {activeLabel}
            </div>
            <div className="console-mono truncate text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
              DECK-A / {activeCode} / {activeHint}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            busy={pinging}
            onClick={triggerPing}
          >
            <ArrowsClockwise className="h-3.5 w-3.5" weight="duotone" />
            {pinging ? "Tuning" : "Ping"}
          </Button>
          <Badge variant="live">REC</Badge>
          <Badge variant="signal">BUS:SSE</Badge>
          <span className="console-readout text-sm">{utc}</span>
          <span className="console-mono text-[10px] text-[color:var(--telltale-cyan)]">
            {packetStub}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warn">DECK-A</Badge>
          <span className="console-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-body)]">
            {activeCode} module armed
          </span>
        </div>
        <ThemeSwitch value={themeMode} onChange={onThemeModeChange} />
      </div>
    </div>
  );
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

  return (
    <div className="deck-plate relative h-9 w-[162px] p-1" role="group" aria-label="主题模式">
      <div className="absolute inset-x-3 top-1/2 h-px bg-[color:var(--chassis-edge)]" />
      <div
        className="absolute top-1/2 h-5 w-5 -translate-y-1/2 border border-[color:var(--telltale-amber)] bg-[color:var(--chassis-raise)] shadow-[var(--glow-amber)] transition-[left] duration-[30ms] ease-linear"
        style={{ left: `${12 + activeIndex * 52}px` }}
      />
      <div className="relative z-10 grid grid-cols-3 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "h-7 font-mono text-[9px] font-bold uppercase tracking-[0.12em] transition",
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

function useUtcTimecode() {
  const [value, setValue] = useState(() => formatUtcTimecode(new Date()));

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setValue(formatUtcTimecode(new Date()));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return value;
}

function formatUtcTimecode(date: Date) {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${String(
    date.getUTCMilliseconds(),
  ).padStart(3, "0")}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
