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
    <div className="flex flex-col gap-4 rounded-[2.25rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6 shadow-[var(--shadow-glass)] backdrop-blur-2xl md:flex-row md:items-end md:justify-between">
      <div className="space-y-3">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.42em] text-[color:var(--accent-rose)]">
          {kicker}
        </p>
        <h1 className="sweet-title text-3xl font-extrabold tracking-tight text-[color:var(--text-strong)] md:text-5xl">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-[color:var(--text-body)] md:text-base">
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
    <Card interactive className={cn("min-h-[10.5rem]", className)}>
      <CardContent className="flex h-full flex-col justify-between gap-5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-[color:var(--text-body)]">{label}</div>
          {icon ? (
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_12px_24px_rgba(255,182,193,0.22)]",
                accentClassName ?? "from-rose-300 to-sky-300",
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>
        <div>
          <div className="sweet-title text-4xl font-extrabold text-[color:var(--text-strong)]">
            {value}
          </div>
          {hint ? (
            <div className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{hint}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  symbol = "૮ ˶ᵔ ᵕ ᵔ˶ ა",
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
      <div className="sweet-title text-2xl font-bold text-[color:var(--text-strong)]">
        {title}
      </div>
      <p className="max-w-md text-sm leading-7 text-[color:var(--text-body)]">
        {description}
      </p>
    </div>
  );
}

export function ProgressTrack({
  label,
  value,
  hint,
  mascot = "🐾",
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
          <div className="text-sm font-semibold text-[color:var(--text-strong)]">{label}</div>
          {hint ? (
            <div className="text-xs text-[color:var(--text-muted)]">{hint}</div>
          ) : null}
        </div>
        <div className="sweet-title text-lg font-bold text-[color:var(--text-strong)]">
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
          <span className="text-lg">{mascot}</span>
        </motion.div>
      </div>
    </div>
  );
}
