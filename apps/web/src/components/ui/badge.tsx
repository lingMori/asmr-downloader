import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "deck-badge inline-flex items-center border px-2 py-0.5 font-bold transition duration-150",
  {
    variants: {
      variant: {
        default:
          "border-[color-mix(in_srgb,var(--tape-pink)_42%,transparent)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        decal:
          "border-[color-mix(in_srgb,var(--tape-pink)_42%,transparent)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        live:
          "border-[color:var(--tape-pink)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)] shadow-[var(--glow-tape)] animate-[flicker_2s_steps(3,end)_infinite]",
        signal:
          "border-[color:var(--phosphor-mid)] bg-[color:var(--phosphor-trail)] text-[color:var(--phosphor-primary)] shadow-[var(--glow-phosphor)]",
        warn:
          "border-[color:var(--telltale-amber)] bg-[rgba(242,169,59,0.14)] text-[color:var(--telltale-amber)] shadow-[var(--glow-amber)]",
        halt:
          "border-[color:var(--telltale-red)] bg-[rgba(255,90,60,0.14)] text-[color:var(--telltale-red)] shadow-[0_0_12px_rgba(255,90,60,0.28)]",
        mute:
          "border-[color:var(--chassis-edge)] bg-transparent text-[color:var(--text-mute)]",
        pink:
          "border-[color-mix(in_srgb,var(--tape-pink)_42%,transparent)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        mint:
          "border-[color:var(--phosphor-mid)] bg-[color:var(--phosphor-trail)] text-[color:var(--phosphor-primary)] shadow-[var(--glow-phosphor)]",
        violet:
          "border-[color:var(--tape-pink)] bg-[color:var(--tape-pink-trail)] text-[color:var(--tape-pink)]",
        blue:
          "border-[color:var(--telltale-cyan)] bg-[rgba(93,211,243,0.12)] text-[color:var(--telltale-cyan)]",
        gold:
          "border-[color:var(--telltale-amber)] bg-[rgba(242,169,59,0.14)] text-[color:var(--telltale-amber)]",
        danger:
          "border-[color:var(--telltale-red)] bg-[rgba(255,90,60,0.14)] text-[color:var(--telltale-red)] shadow-[0_0_12px_rgba(255,90,60,0.28)]",
        ghost:
          "border-[color:var(--chassis-edge)] bg-transparent text-[color:var(--text-mute)]",
      },
      active: {
        true: "shadow-[0_0_0_2px_var(--tape-pink-trail)]",
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
