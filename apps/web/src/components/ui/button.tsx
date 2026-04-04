import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, PointerEvent } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center overflow-hidden rounded-full border text-sm font-semibold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,138,101,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "sweet-button-primary",
        secondary: "sweet-button-secondary",
        ghost: "sweet-button-ghost",
        danger: "sweet-button-danger",
      },
      size: {
        default: "h-12 px-5 py-2",
        sm: "h-10 px-4 text-xs",
        lg: "h-14 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  children,
  onPointerDown,
  ...props
}: ButtonProps) {
  const [ripples, setRipples] = useState<
    Array<{ id: number; x: number; y: number; size: number }>
  >([]);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    onPointerDown?.(event);
    if (event.defaultPrevented || props.disabled) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const sizePx = Math.max(rect.width, rect.height) * 1.2;
    const nextRipple = {
      id: Date.now() + Math.random(),
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      size: sizePx,
    };

    setRipples((current) => [...current, nextRipple]);
    window.setTimeout(() => {
      setRipples((current) => current.filter((ripple) => ripple.id !== nextRipple.id));
    }, 700);
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      onPointerDown={handlePointerDown}
      {...props}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="sweet-button-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
