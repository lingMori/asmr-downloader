import { cn } from "@/lib/utils";

export type StepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  className?: string;
};

export function Stepper({ value, min = 1, max = 8, onChange, label, className }: StepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className={cn("y-stepper", className)} role="group" aria-label={label}>
      <button
        type="button"
        className="y-stepper__btn"
        aria-label="减少"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <span className="y-stepper__value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="y-stepper__btn"
        aria-label="增加"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        ＋
      </button>
    </div>
  );
}
