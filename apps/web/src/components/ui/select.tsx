import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("cli-bay w-full", className)}>
      <select className="cli-field appearance-none" {...props}>
        {children}
      </select>
    </span>
  );
}
