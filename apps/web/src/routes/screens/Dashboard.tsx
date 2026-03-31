import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FolderOpen, Search, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";

export function Dashboard() {
  const reportQuery = useQuery({
    queryKey: ["dashboard", "report"],
    queryFn: () => apiClient.getReport(),
  });
  const tasksQuery = useQuery({
    queryKey: ["dashboard", "tasks"],
    queryFn: () => apiClient.getTasks(),
  });
  const libraryQuery = useQuery({
    queryKey: ["dashboard", "library"],
    queryFn: () => apiClient.getLibraryWorks({ page: 1, pageSize: 6 }),
  });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Dashboard
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Product overview
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Start from discovery, queue downloads, watch sync health, and browse your local library.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Metadata indexed"
          value={reportQuery.data?.totals.metadata ?? 0}
        />
        <MetricCard
          label="Jobs in queue"
          value={tasksQuery.data?.total ?? 0}
        />
        <MetricCard
          label="Library works"
          value={libraryQuery.data?.total ?? 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickLink
          to="/discover"
          icon={Search}
          title="Discover works"
          description="Search by keyword, tags, circle, and VA."
        />
        <QuickLink
          to="/queue"
          icon={Workflow}
          title="Open queue"
          description="Inspect downloads, sync jobs, and failures."
        />
        <QuickLink
          to="/library"
          icon={FolderOpen}
          title="Browse library"
          description="Inspect downloaded works and local files."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Recent queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(tasksQuery.data?.items ?? []).slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-white">{task.name}</div>
                    <div className="text-xs text-slate-400">{task.type}</div>
                  </div>
                  <div className="text-sm text-amber-300">{task.status}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Sync health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressRow
              label="Overall progress"
              value={reportQuery.data?.progress.overall ?? 0}
            />
            <ProgressRow
              label="Subtitle coverage"
              value={reportQuery.data?.progress.withSubtitle ?? 0}
            />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Summary
                label="Completed"
                value={reportQuery.data?.downloads.completed ?? 0}
              />
              <Summary
                label="Failed"
                value={reportQuery.data?.downloads.failed ?? 0}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardContent className="space-y-3">
        <div className="text-sm text-slate-400">{label}</div>
        <div className="text-4xl font-semibold text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: "/" | "/discover" | "/queue" | "/library" | "/sync" | "/settings";
  icon: typeof Search;
  title: string;
  description: string;
}) {
  return (
    <Link to={to}>
      <Card className="border-white/10 bg-white/6 backdrop-blur-xl transition hover:border-amber-400/40">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Icon className="h-4 w-4 text-amber-300" />
            <ArrowRight className="h-4 w-4 text-slate-500" />
          </div>
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="text-sm leading-6 text-slate-400">{description}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/8">
        <div
          className="h-2 rounded-full bg-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}
