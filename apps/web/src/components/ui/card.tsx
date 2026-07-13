import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
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
    <div
      data-accented={foil ? "true" : undefined}
      className={cn(
        "group relative",
        Surface,
        interactive &&
          "cursor-pointer transition-[background-color,border-color] duration-150 hover:border-[color:var(--interactive-border)] hover:bg-[color:var(--surface-elevated)]",
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
  return <div className={cn("relative p-3", className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative p-3 pb-0", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "console-title text-sm font-bold text-[color:var(--text-display)]",
        className,
      )}
      {...props}
    />
  );
}
