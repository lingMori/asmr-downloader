import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";

export function Settings() {
  const configQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiClient.getConfig(),
  });

  if (configQuery.isLoading) {
    return <div className="text-slate-400">Loading settings...</div>;
  }

  if (configQuery.isError || !configQuery.data) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
        Failed to load configuration from backend.
      </div>
    );
  }

  const { user, downloader, limit } = configQuery.data;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Settings
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Runtime and downloader configuration
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          This page is now aligned to product configuration, but persistence is still backend-owned.
          The next backend slice should make these fields editable through a dedicated settings API.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section
          title="Account"
          rows={[
            ["Account", user.account || "-"],
            ["Password", user.password || "-"],
          ]}
        />
        <Section
          title="Downloader"
          rows={[
            ["API URL", downloader.api_url || "-"],
            ["Proxy", downloader.proxy_url || "-"],
            ["Sync folder", downloader.sync_data_folder || "-"],
            ["Prefer media", downloader.prefer_media || "-"],
            ["Max workers", String(downloader.max_workers ?? "-")],
            ["Max retries", String(downloader.max_retries ?? "-")],
            ["Wanted size", downloader.sync_wanted_size || "-"],
          ]}
        />
        <Section
          title="Rate limits"
          rows={[
            ["Sync QPS", String(limit.sync_qps)],
            ["Download QPS", String(limit.download_qps)],
            ["Sync jitter min", String(limit.sync_jitter_min ?? "-")],
            ["Sync jitter max", String(limit.sync_jitter_max ?? "-")],
            ["Download jitter min", String(limit.download_jitter_min ?? "-")],
            ["Download jitter max", String(limit.download_jitter_max ?? "-")],
          ]}
        />
      </div>
    </section>
  );
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-slate-500">{label}</div>
            <div className="mt-1 text-slate-100">{value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
