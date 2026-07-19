import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
};

export function Toggle({ checked, onChange, label, className, type = "button", ...rest }: ToggleProps) {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn("y-toggle", checked && "is-on", className)}
      onClick={(e) => {
        onChange(!checked);
        rest.onClick?.(e);
      }}
      {...rest}
    >
      <span className="y-toggle__knob" />
    </button>
  );
}
