import "@/styles/pages/settings.css";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui";
import { DownloadCard } from "@/components/settings/DownloadCard";
import { SourceCard } from "@/components/settings/SourceCard";
import { AppearanceCard } from "@/components/settings/AppearanceCard";
import { AboutCard } from "@/components/settings/AboutCard";
import { errorMessage } from "@/components/settings/FieldRow";

/** 设置(下载/数据源/外观/关于):桌面 2 列 max 1100px,≤1100 单列 */
export function SettingsScreen() {
  const configQuery = useQuery({
    queryKey: keys.config,
    queryFn: () => apiClient.getConfig(),
    staleTime: 30_000,
  });

  return (
    <div className="y-page">
      <PageHeader title="设置" kana="せってい" badge="保存即生效 · 写入 config.toml" />
      {configQuery.isLoading && (
        <div className="y-set-grid">
          <Skeleton className="y-set-skel" count={4} />
        </div>
      )}
      {configQuery.isError && (
        <div className="y-set-load-error">
          <div className="y-set-error" role="alert">
            配置加载失败:{errorMessage(configQuery.error)}
            <button
              type="button"
              className="y-set-mini-btn"
              onClick={() => void configQuery.refetch()}
            >
              重试
            </button>
          </div>
        </div>
      )}
      {configQuery.data && (
        <div className="y-set-grid">
          <div className="y-set-col">
            <DownloadCard config={configQuery.data} />
            <AppearanceCard />
          </div>
          <div className="y-set-col">
            <SourceCard config={configQuery.data} />
            <AboutCard />
          </div>
        </div>
      )}
    </div>
  );
}
