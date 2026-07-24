import type { ReactNode } from "react";

export type PageHeaderProps = {
  /** 大标题,如「在线曲库」 */
  title: string;
  /** 假名小字,如「おんらいん」 */
  kana?: string;
  /** 标题旁的虚线徽章,如「asmr.one 直连 · 免下载即听」 */
  badge?: ReactNode;
  /** 右侧内容(统计文本、排序 chips 等) */
  aside?: ReactNode;
};

/** 页头(editorial 版式:假名 eyebrow 在上 + display 大标题 + 右侧统计/操作位) */
export function PageHeader({ title, kana, badge, aside }: PageHeaderProps) {
  return (
    <div className="y-page-head">
      <div className="y-page-head__titles">
        {kana && <div className="y-page-head__kana">{kana}</div>}
        <div className="y-page-head__title">{title}</div>
      </div>
      {badge && <span className="y-page-head__badge">{badge}</span>}
      {aside && <div className="y-page-head__aside">{aside}</div>}
    </div>
  );
}
