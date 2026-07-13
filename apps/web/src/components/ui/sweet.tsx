import type { ReactNode } from "react";
import { type Variants } from "framer-motion";
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
    <header className="page-heading" aria-label={kicker}>
      <div className="page-heading-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {meta ? <div className="page-heading-meta w-full md:w-auto">{meta}</div> : null}
    </header>
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
    <div className={cn("metric-block", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="metric-label">{label}</div>
        {icon ? <div className="text-[color:var(--accent)]">{icon}</div> : null}
      </div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
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
    <div className={cn("empty-state", className)}>
      <div className="text-xs font-semibold text-[color:var(--accent)]">{symbol}</div>
      <div className="mt-2 text-base font-semibold text-[color:var(--text-display)]">{title}</div>
      <p className="mt-1 max-w-md text-sm leading-5 text-[color:var(--text-body)]">{description}</p>
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
    <div className="route-feedback mx-auto flex min-h-[10rem] flex-col justify-center gap-3">
      <div className="text-xs font-semibold text-[color:var(--text-mute)]">
        {tone === "halt" ? "ERROR" : tone === "signal" ? "READY" : "STATUS"}
      </div>
      <div className={`console-title text-xl font-bold leading-tight ${toneClass}`}>
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
    <div className={cn("buffering-line flex items-center px-3 text-xs", className)} role="status">
      <span className="relative z-10">正在加载 {percent}%</span>
      <span className="sr-only">{filled} / 10</span>
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
        <div
          className="tape-track"
          data-running={running ? "true" : undefined}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="tape-track__fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
