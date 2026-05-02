import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 180,
      damping: 18,
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
    <div className="console-panel flex flex-col gap-4 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-[var(--shadow-glass)] backdrop-blur-xl md:flex-row md:items-end md:justify-between">
      <div className="relative z-10 space-y-2">
        <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[color:var(--accent-amber)]">
          {kicker}
        </p>
        <h1 className="console-title text-2xl font-extrabold uppercase text-[color:var(--text-strong)] md:text-4xl">
          {title}
        </h1>
        <p className="max-w-4xl text-sm leading-6 text-[color:var(--text-body)]">
          {description}
        </p>
      </div>
      {meta ? <div className="relative z-10 shrink-0">{meta}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accentClassName,
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
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-body)]">{label}</div>
          {icon ? (
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--panel-border)] bg-gradient-to-br text-[#06100b] shadow-[var(--shadow-glow)]",
                accentClassName ?? "from-emerald-400 to-amber-400",
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>
        <div>
          <div className="console-readout text-3xl font-bold text-[color:var(--text-strong)]">
            {value}
          </div>
          {hint ? (
            <div className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{hint}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  symbol = "NO DATA",
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
    <div className={cn("sweet-empty-state", className)}>
      <div className="sweet-empty-bubble">{symbol}</div>
      <div className="console-title text-xl font-bold uppercase text-[color:var(--text-strong)]">
        {title}
      </div>
      <p className="max-w-md text-sm leading-6 text-[color:var(--text-body)]">
        {description}
      </p>
    </div>
  );
}

export function ProgressTrack({
  label,
  value,
  hint,
  mascot: _mascot = "MARK",
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  mascot?: string;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-strong)]">{label}</div>
          {hint ? (
            <div className="text-xs text-[color:var(--text-muted)]">{hint}</div>
          ) : null}
        </div>
        <div className="console-readout text-base font-bold text-[color:var(--text-strong)]">
          {percent}%
        </div>
      </div>
      <div className="mascot-progress">
        <div className="mascot-progress__fill" style={{ width: `${percent}%` }} />
        <motion.div
          className="mascot-progress__runner"
          animate={{ left: `${percent}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
        >
          <span>{_mascot}</span>
        </motion.div>
      </div>
    </div>
  );
}
