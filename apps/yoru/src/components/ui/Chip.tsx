import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  /** 选中态(navOn 底 + lineStrong 边) */
  active?: boolean;
};

export function Chip({ children, active, className, type = "button", ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={active} className={cn("y-chip", active && "is-on", className)} {...rest}>
      {children}
    </button>
  );
}
