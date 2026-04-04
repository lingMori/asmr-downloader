import type { HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive = false,
  foil = false,
  ...props
}: HTMLMotionProps<"div"> & {
  interactive?: boolean;
  foil?: boolean;
}) {
  return (
    <motion.div
      whileHover={
        interactive
          ? {
              y: -8,
              scale: 1.01,
            }
          : undefined
      }
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className={cn(
        "group relative overflow-hidden rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] shadow-[var(--shadow-glass)] backdrop-blur-2xl",
        interactive &&
          "sweet-card-interactive cursor-pointer border-[color:var(--panel-border-strong)] shadow-[0_18px_40px_rgba(255,182,193,0.22)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-0", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "sweet-title text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--text-body)]",
        className,
      )}
      {...props}
    />
  );
}
