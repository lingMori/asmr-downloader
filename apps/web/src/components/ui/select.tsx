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
        "h-12 w-full rounded-[1.4rem] border border-[color:var(--panel-border)] bg-white/65 px-4 text-sm text-[color:var(--text-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-[rgba(255,138,101,0.35)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
