import { toast } from "sonner";
import { useSettings, type Palette, type ThemeSetting } from "@/lib/settings";
import { Toggle } from "@/components/ui";
import { SettingsCard } from "./SettingsCard";
import { FieldRow } from "./FieldRow";
import { cn } from "@/lib/utils";

const THEME_OPTS: { id: ThemeSetting; label: string; sym: string }[] = [
  { id: "dark", label: "夜間モード", sym: "☾" },
  { id: "light", label: "デイモード", sym: "☀" },
  { id: "system", label: "跟随系统", sym: "◐" },
];

/** 4 组 palette(原型 data-props,值同 tokens.css 的 [data-palette] 注入) */
const PALETTE_OPTS: { id: Palette; name: string; colors: [string, string] }[] = [
  { id: "lavender", name: "ラベンダー", colors: ["#cdbcf5", "#f5bcd4"] },
  { id: "blue", name: "ブルー", colors: ["#a8c8f0", "#bde8d8"] },
  { id: "orange", name: "オレンジ", colors: ["#f5cba8", "#f5bcd4"] },
  { id: "green", name: "グリーン", colors: ["#c3f0d8", "#cdbcf5"] },
];

/** 「外观」卡:主题/贴纸/配色,全部即时生效(useSettings 已接管 dataset) */
export function AppearanceCard() {
  const { settings, update } = useSettings();

  return (
    <SettingsCard title="外观 · がいかん" color="pink" rotate={2}>
      <div className="y-set-field">
        <div className="y-set-row__text">
          <div className="y-set-row__label">主题</div>
          <div className="y-set-row__desc">夜间为默认;日间适合白天整理媒体库</div>
        </div>
        <div className="y-set-themes" role="radiogroup" aria-label="主题">
          {THEME_OPTS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={settings.theme === t.id}
              className={cn("y-set-theme-opt", settings.theme === t.id && "is-on")}
              onClick={() => update({ theme: t.id })}
            >
              <span className="sym">{t.sym}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <FieldRow label="贴纸徽章" desc="作品卡片上的手帐风旋转贴纸">
        <Toggle
          checked={settings.stickers}
          label="贴纸徽章"
          onChange={(v) => update({ stickers: v })}
        />
      </FieldRow>
      <div className="y-set-field">
        <div className="y-set-row__text">
          <div className="y-set-row__label">配色</div>
          <div className="y-set-row__desc">主色组合,全站即时生效</div>
        </div>
        <div className="y-set-swatches" role="radiogroup" aria-label="配色">
          {PALETTE_OPTS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={settings.palette === p.id}
              aria-label={`配色 ${p.name}`}
              className={cn("y-set-swatch", settings.palette === p.id && "is-on")}
              style={{
                background: `linear-gradient(135deg, ${p.colors[0]} 50%, ${p.colors[1]} 50%)`,
              }}
              onClick={() => update({ palette: p.id })}
            />
          ))}
        </div>
      </div>
    </SettingsCard>
  );
}

/** 通知开关的权限请求逻辑(关于卡用):开启时先确认/请求浏览器权限 */
export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") {
    toast.error("当前环境不支持系统通知");
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    toast.error("通知权限已被浏览器拒绝,请在浏览器设置中允许通知");
    return false;
  }
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      return true;
    }
    toast.error("未获得通知权限,保持关闭");
    return false;
  } catch {
    toast.error("请求通知权限失败,保持关闭");
    return false;
  }
}
