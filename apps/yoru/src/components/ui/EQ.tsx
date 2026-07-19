import { cn } from "@/lib/utils";

export type EQProps = {
  playing: boolean;
  className?: string;
};

/** EQ 五柱,错相位;暂停态静止在 scaleY(.3) */
export function EQ({ playing, className }: EQProps) {
  return (
    <div className={cn("y-eq", playing && "is-playing", className)} aria-hidden="true">
      <span className="y-eq__bar" />
      <span className="y-eq__bar" />
      <span className="y-eq__bar" />
      <span className="y-eq__bar" />
      <span className="y-eq__bar" />
    </div>
  );
}
