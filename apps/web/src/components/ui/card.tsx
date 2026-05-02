import type { HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type CardProps = HTMLMotionProps<"div"> & {
  interactive?: boolean;
  foil?: boolean;
  surface?: "chassis" | "screen";
};

export function Card({
  className,
  interactive = false,
  foil = false,
  surface = "chassis",
  ...props
}: CardProps) {
  const Surface = surface === "screen" ? "deck-screen" : "deck-chassis";
  return (
    <motion.div
      whileHover={
        interactive
          ? {
              filter: "brightness(1.06)",
            }
          : undefined
      }
      transition={{ duration: 0.16, ease: [0.6, 0, 0.4, 1] }}
      data-live={foil ? "true" : undefined}
      className={cn(
        "group relative overflow-hidden",
        Surface,
        interactive && "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export function ChassisCard(props: Omit<CardProps, "surface">) {
  return <Card surface="chassis" {...props} />;
}

export function ScreenCard(props: Omit<CardProps, "surface">) {
  return <Card surface="screen" {...props} />;
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative z-10 p-4", className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative z-10 p-4 pb-0", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "console-title text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--text-body)]",
        className,
      )}
      {...props}
    />
  );
}
