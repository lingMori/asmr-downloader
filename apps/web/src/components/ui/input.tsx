import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={cn("cli-bay w-full", className)}>
      <input className="cli-field" {...props} />
    </span>
  );
}
