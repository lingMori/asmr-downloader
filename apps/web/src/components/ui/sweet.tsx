import type { ReactNode } from "react";
import { type Variants } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.03,
    },
  },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, scaleY: 0.96 },
  show: {
    opacity: 1,
    scaleY: 1,
    transition: {
      duration: 0.18,
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
    <div className="deck-chassis flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-3">
        <span className="deck-decal">{kicker}</span>
        <h1 className="console-title text-3xl font-black uppercase text-[color:var(--text-display)] md:text-5xl">
          {title}
        </h1>
        <p className="max-w-4xl text-sm font-medium leading-6 text-[color:var(--text-body)]">
          {description}
        </p>
      </div>
      {meta ? <div className="shrink-0">{meta}</div> : null}
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
    <Card interactive className={cn("min-h-[8.75rem]", className)}>
      <CardContent className="flex h-full flex-col justify-between gap-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="deck-decal">{label}</div>
          {icon ? (
            <div className="deck-plate flex h-10 w-10 items-center justify-center text-[color:var(--telltale-amber)]">
              {icon}
            </div>
          ) : null}
        </div>
        <div className="deck-screen p-4">
          <div className="console-readout text-3xl font-bold">
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
  symbol = "NO SIGNAL",
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
    <div className={cn("deck-screen test-pattern flex flex-col justify-center gap-4", className)}>
      <div className="mx-auto w-full max-w-xl border border-[color:var(--phosphor-mid)] bg-[rgba(0,0,0,0.32)] p-6 text-center">
        <div className="console-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--telltale-amber)]">
          {symbol}
        </div>
        <div className="standby-text console-title mt-5 text-4xl font-black text-[color:var(--phosphor-primary)]">
          STAND BY
        </div>
        <div className="console-title mt-3 text-2xl font-bold text-[color:var(--text-display)]">
          {title}
        </div>
        <p className="mx-auto mt-4 max-w-md font-mono text-xs leading-6 text-[color:var(--text-body)]">
          {description}
        </p>
      </div>
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
    <div className={cn("deck-screen tbc-line p-4 text-xs uppercase tracking-[0.16em]", className)}>
      BUFFERING . . . [{Array.from({ length: 10 }).map((_, index) => (
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
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="console-title text-sm font-bold text-[color:var(--text-display)]">{label}</div>
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
