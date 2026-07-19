import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sticker } from "@/components/ui";

export type SettingsCardProps = {
  /** 角标贴纸文案,如「下载 · だうんろーど」 */
  title: string;
  color?: "pink" | "lav";
  rotate?: number;
  /** 紧凑行距(关于卡) */
  tight?: boolean;
  children: ReactNode;
};

/** 设置页贴纸 section 卡(原型 dc.html:392 的卡片 + 角标贴纸) */
export function SettingsCard({ title, color = "pink", rotate = -2, tight, children }: SettingsCardProps) {
  return (
    <section className="y-set-card">
      <Sticker section color={color} rotate={rotate}>
        {title}
      </Sticker>
      <div className={cn("y-set-card__body", tight && "y-set-card__body--tight")}>{children}</div>
    </section>
  );
}
