import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] px-3 font-mono text-sm text-[color:var(--text-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--interactive-border)] focus:outline-none focus:ring-2 focus:ring-[rgba(68,190,129,0.22)]",
        className,
      )}
      {...props}
    />
  );
}
