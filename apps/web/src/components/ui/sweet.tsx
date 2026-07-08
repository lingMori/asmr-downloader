import type { ReactNode } from "react";
import { type Variants } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.02,
      delayChildren: 0,
    },
  },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, scaleY: 0.96 },
  show: {
    opacity: 1,
    scaleY: 1,
    transition: {
      duration: 0.12,
      ease: [0.6, 0, 0.4, 1],
    },
  },
};

export function PageHeader({
  kicker,
  title,
  description,
  meta,
}: {
  kicker: string;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <div className="deck-chassis beam-border flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <span className="deck-decal">{kicker}</span>
        <h1 className="console-title text-[2rem] font-black leading-none text-[color:var(--text-display)] md:text-[2.45rem]">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-5 text-[color:var(--text-body)] md:text-[15px]">
          {description}
        </p>
      </div>
      {meta ? <div className="hidden shrink-0 md:block">{meta}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accentClassName?: string;
  className?: string;
}) {
  return (
    <Card interactive className={cn("min-h-[7rem]", className)}>
      <CardContent className="flex h-full flex-col justify-between gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="deck-decal">{label}</div>
          {icon ? (
            <div className="deck-plate flex h-8 w-8 items-center justify-center text-[color:var(--telltale-amber)]">
              {icon}
            </div>
          ) : null}
        </div>
        <div className="deck-screen p-3">
          <div className="console-readout text-3xl font-bold leading-none">
            {value}
          </div>
          {hint ? (
            <div className="mt-2 text-xs leading-5 text-[color:var(--text-body)]">{hint}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  symbol = "空状态",
  title,
  description,
  className,
}: {
  symbol?: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("deck-screen flex flex-col justify-center gap-3 p-4", className)}>
      <div className="mx-auto w-full max-w-xl border border-[color:var(--phosphor-mid)] bg-[rgba(0,0,0,0.24)] p-4 text-center">
        <div className="deck-decal mx-auto">
          {symbol}
        </div>
        <div className="standby-text console-title mt-3 text-3xl font-black leading-none text-[color:var(--phosphor-primary)]">
          STAND BY
        </div>
        <div className="mt-2 text-base font-semibold text-[color:var(--text-display)]">
          {title}
        </div>
        <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-[color:var(--text-body)]">
          {description}
        </p>
      </div>
    </div>
  );
}

export function RouteFeedback({
  tone = "warn",
  title,
  description,
  action,
}: {
  tone?: "warn" | "halt" | "signal";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const toneClass =
    tone === "halt"
      ? "text-[color:var(--telltale-red)]"
      : tone === "signal"
        ? "text-[color:var(--phosphor-primary)]"
        : "text-[color:var(--telltale-amber)]";

  return (
    <div className="deck-screen mx-auto flex min-h-[12rem] max-w-3xl flex-col justify-center gap-3 p-4">
      <div className="deck-decal w-fit">
        {tone === "halt" ? "ERROR" : tone === "signal" ? "READY" : "STATUS"}
      </div>
      <div className={`console-title text-2xl font-black leading-none ${toneClass}`}>
        {title}
      </div>
      <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-body)]">
        {description}
      </p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function BufferingLine({
  percent = 32,
  className,
}: {
  percent?: number;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return (
    <div className={cn("deck-screen tbc-line p-3 text-xs", className)}>
      加载中 [{Array.from({ length: 10 }).map((_, index) => (
        <span key={index}>{index < filled ? "▓" : "░"}</span>
      ))}] {percent}%
    </div>
  );
}

export function ProgressTrack({
  label,
  value,
  hint,
  running = false,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  running?: boolean;
  mascot?: string;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[color:var(--text-display)]">{label}</div>
          {hint ? (
            <div className="mt-1 text-xs text-[color:var(--text-mute)]">{hint}</div>
          ) : null}
        </div>
        <div className="console-readout text-base font-bold">{percent}%</div>
      </div>
      <div className="mascot-progress">
        <div className="tape-reel" data-running={running ? "true" : undefined} />
        <div className="tape-track" data-running={running ? "true" : undefined}>
          <div className="tape-track__fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="tape-reel" data-running={running ? "true" : undefined} />
      </div>
    </div>
  );
}
