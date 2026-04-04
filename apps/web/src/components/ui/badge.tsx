import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition duration-300",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(255,182,193,0.4)] bg-white/60 text-[color:var(--text-strong)]",
        pink:
          "border-rose-300/60 bg-rose-100/90 text-rose-700 shadow-[0_12px_24px_rgba(255,182,193,0.2)]",
        mint:
          "border-emerald-300/60 bg-emerald-100/90 text-emerald-700 shadow-[0_12px_24px_rgba(125,217,198,0.18)]",
        violet:
          "border-violet-300/60 bg-violet-100/90 text-violet-700 shadow-[0_12px_24px_rgba(181,156,255,0.18)]",
        blue:
          "border-sky-300/60 bg-sky-100/90 text-sky-700 shadow-[0_12px_24px_rgba(124,184,255,0.2)]",
        gold:
          "border-amber-300/60 bg-amber-100/90 text-amber-700 shadow-[0_12px_24px_rgba(255,211,110,0.2)]",
        danger:
          "border-rose-400/50 bg-rose-500/12 text-rose-500 shadow-[0_12px_24px_rgba(255,104,144,0.14)]",
        ghost:
          "border-white/25 bg-white/40 text-[color:var(--text-body)]",
      },
      active: {
        true: "scale-105 shadow-[0_0_0_6px_rgba(255,182,193,0.16)]",
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
