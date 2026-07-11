import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center overflow-hidden border text-xs font-bold transition-[filter,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tape-pink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--chassis-base)] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "deck-button-primary",
        primary: "deck-button-primary",
        secondary: "deck-button-secondary",
        ghost: "deck-button-ghost",
        danger: "deck-button-danger",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-11 px-3 text-[11px] md:h-9",
        lg: "h-12 px-5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    busy?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  busy,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      data-busy={busy ? "true" : undefined}
      aria-busy={busy || undefined}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
