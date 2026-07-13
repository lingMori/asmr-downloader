import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "deck-badge inline-flex items-center border px-2 py-0.5 font-semibold transition-colors duration-150",
  {
    variants: {
      variant: {
        default:
          "border-[color-mix(in_srgb,var(--tape-pink)_42%,transparent)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        decal:
          "border-[color-mix(in_srgb,var(--tape-pink)_42%,transparent)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        live:
          "border-[color:var(--tape-pink)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        signal:
          "border-[color:var(--phosphor-mid)] bg-[color:var(--phosphor-trail)] text-[color:var(--phosphor-primary)]",
        warn:
          "border-[color:var(--telltale-amber)] bg-[color:var(--warning-soft)] text-[color:var(--telltale-amber)]",
        halt:
          "border-[color:var(--telltale-red)] bg-[color:var(--danger-soft)] text-[color:var(--telltale-red)]",
        mute:
          "border-[color:var(--chassis-edge)] bg-transparent text-[color:var(--text-mute)]",
        pink:
          "border-[color-mix(in_srgb,var(--tape-pink)_42%,transparent)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        mint:
          "border-[color:var(--phosphor-mid)] bg-[color:var(--phosphor-trail)] text-[color:var(--phosphor-primary)]",
        violet:
          "border-[color:var(--tape-pink)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        blue:
          "border-[color:var(--telltale-cyan)] bg-[color:var(--info-soft)] text-[color:var(--telltale-cyan)]",
        gold:
          "border-[color:var(--telltale-amber)] bg-[color:var(--warning-soft)] text-[color:var(--telltale-amber)]",
        danger:
          "border-[color:var(--telltale-red)] bg-[color:var(--danger-soft)] text-[color:var(--telltale-red)]",
        ghost:
          "border-[color:var(--chassis-edge)] bg-transparent text-[color:var(--text-mute)]",
      },
      active: {
        true: "ring-2 ring-[color:var(--tape-pink-trail)]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "decal",
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
    <span className={cn(badgeVariants({ variant, active }), className)} {...props} />
  );
}
