import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition duration-200",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] text-[color:var(--text-strong)]",
        pink:
          "border-[rgba(225,104,84,0.55)] bg-[rgba(225,104,84,0.13)] text-[color:var(--accent-red)] shadow-[0_0_18px_rgba(225,104,84,0.08)]",
        mint:
          "border-[rgba(90,193,176,0.55)] bg-[rgba(90,193,176,0.12)] text-[color:var(--accent-mint)] shadow-[0_0_18px_rgba(90,193,176,0.08)]",
        violet:
          "border-[rgba(164,145,208,0.52)] bg-[rgba(164,145,208,0.13)] text-[color:var(--accent-violet)] shadow-[0_0_18px_rgba(164,145,208,0.08)]",
        blue:
          "border-[rgba(95,155,211,0.55)] bg-[rgba(95,155,211,0.12)] text-[color:var(--accent-blue)] shadow-[0_0_18px_rgba(95,155,211,0.08)]",
        gold:
          "border-[rgba(228,164,72,0.6)] bg-[rgba(228,164,72,0.13)] text-[color:var(--accent-amber)] shadow-[0_0_18px_rgba(228,164,72,0.08)]",
        danger:
          "border-[rgba(225,104,84,0.7)] bg-[rgba(225,104,84,0.18)] text-[color:var(--accent-red)] shadow-[0_0_18px_rgba(225,104,84,0.12)]",
        ghost:
          "border-[color:var(--panel-border)] bg-transparent text-[color:var(--text-body)]",
      },
      active: {
        true: "border-[color:var(--interactive-border)] shadow-[0_0_0_3px_rgba(68,190,129,0.12)]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      active: false,
    },
  },
);

export function Badge({
  className,
  variant,
  active,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(
        badgeVariants({ variant, active }),
        className,
      )}
      {...props}
    />
  );
}
