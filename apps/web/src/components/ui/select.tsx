import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
