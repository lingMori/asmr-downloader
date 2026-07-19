import type { ReactNode } from "react";

/** 字段行:左侧标题+说明,右侧控件(原型 dc.html:395 的行式) */
export function FieldRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="y-set-row">
      <div className="y-set-row__text">
        <div className="y-set-row__label">{label}</div>
        {desc ? <div className="y-set-row__desc">{desc}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** 粉色错误条(保存/登录失败回显 err.message) */
export function ErrorStrip({ message }: { message: string }) {
  return (
    <div className="y-set-error" role="alert">
      {message}
    </div>
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return String(err);
}
