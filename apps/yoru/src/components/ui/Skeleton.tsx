import { cn } from "@/lib/utils";

export type SkeletonProps = {
  /** card:方块封面卡;row:列表行;block:纯占位块(尺寸全由 className 定) */
  variant?: "card" | "row" | "block";
  count?: number;
  className?: string;
};

export function Skeleton({ variant = "row", count = 1, className }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            "y-skeleton",
            variant !== "block" && `y-skeleton--${variant}`,
            className,
          )}
        />
      ))}
    </>
  );
}
