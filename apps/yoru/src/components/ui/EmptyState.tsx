import type { ReactNode } from "react";
import { Moon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  /** 图标(文本或图标组件),默认 Moon */
  icon?: ReactNode;
  children: ReactNode;
  /** 可选操作区(按钮/链接) */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn("y-empty", className)}>
      <span className="y-empty__icon">{icon ?? <Moon size={20} />}</span>
      <div>{children}</div>
      {action}
    </div>
  );
}
