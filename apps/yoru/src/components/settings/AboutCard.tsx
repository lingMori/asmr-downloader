import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { useSettings } from "@/lib/settings";
import { Sticker, Toggle } from "@/components/ui";
import { SettingsCard } from "./SettingsCard";
import { FieldRow } from "./FieldRow";
import { requestNotifyPermission } from "./AppearanceCard";

/** 「关于」卡:版本/代号/仓库链接 + 系统通知开关(原型 dc.html:448-461) */
export function AboutCard() {
  const { settings, update } = useSettings();
  const healthQuery = useQuery({
    queryKey: keys.health,
    queryFn: () => apiClient.getHealth(),
    staleTime: 60_000,
  });

  const handleNotify = async (next: boolean) => {
    if (!next) {
      update({ notify: false });
      return;
    }
    if (await requestNotifyPermission()) {
      update({ notify: true });
    }
  };

  return (
    <SettingsCard title="关于 · あばうと" color="lav" rotate={-2} tight>
      <div className="y-set-about-title">
        <span className="y-set-about-name">ASMRoner</span>
        <Sticker color="lav" className="y-sticker--inline">
          {healthQuery.data?.version ?? "…"}
        </Sticker>
        <Sticker className="y-sticker--inline">代号「夜 · YORU」</Sticker>
      </div>
      <div className="y-set-about-desc">后端 API v1 · 本地服务 :8080 · 前端 React + Vite</div>
      <FieldRow label="系统通知" desc="任务完成时发送系统通知">
        <Toggle checked={settings.notify} label="系统通知" onChange={(v) => void handleNotify(v)} />
      </FieldRow>
      <div className="y-set-actions">
        <a
          className="y-set-mini-btn"
          href="https://github.com/lingMori/asmr-downloader"
          target="_blank"
          rel="noreferrer"
        >
          GitHub 仓库 →
        </a>
      </div>
    </SettingsCard>
  );
}
