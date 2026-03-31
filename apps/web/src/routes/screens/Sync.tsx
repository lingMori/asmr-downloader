import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, RotateCcw, ServerCrash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useTaskEvents } from "@/lib/useTaskEvents";

export function Sync() {
  const queryClient = useQueryClient();
  const reportQuery = useQuery({
    queryKey: ["sync", "report"],
    queryFn: () => apiClient.getReport(),
  });

  useTaskEvents(() => {
    queryClient.invalidateQueries({ queryKey: ["sync", "report"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  });

  const queueMutation = useMutation({
    mutationFn: async (mode: "metadata" | "download" | "retry") => {
      if (mode === "metadata") {
        return apiClient.queueSyncMetadata();
      }
      if (mode === "download") {
        return apiClient.queueSyncDownload();
      }
      return apiClient.queueSyncRetry();
    },
    onSuccess: (res, mode) => {
      toast.success(`Queued ${mode} task #${res.taskId}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Sync
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Control metadata and batch sync
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActionCard
          title="Metadata sync"
          description="Refresh metadata index from the remote source."
          icon={RefreshCcw}
          onClick={() => queueMutation.mutate("metadata")}
        />
        <ActionCard
          title="Sync download"
          description="Queue batch download for pending synchronized works."
          icon={ServerCrash}
          onClick={() => queueMutation.mutate("download")}
        />
        <ActionCard
          title="Retry failed"
          description="Retry failed synchronized downloads."
          icon={RotateCcw}
          onClick={() => queueMutation.mutate("retry")}
        />
      </div>

      <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Sync report</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Stat label="Metadata works" value={reportQuery.data?.totals.metadata ?? 0} />
          <Stat label="Subtitle works" value={reportQuery.data?.totals.subtitle ?? 0} />
          <Stat
            label="Completed downloads"
            value={reportQuery.data?.downloads.completed ?? 0}
          />
          <Stat label="Failed downloads" value={reportQuery.data?.downloads.failed ?? 0} />
          <Stat label="Pending downloads" value={reportQuery.data?.downloads.pending ?? 0} />
          <Stat
            label="Overall progress"
            value={`${Math.round((reportQuery.data?.progress.overall ?? 0) * 100)}%`}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function ActionCard({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: typeof RefreshCcw;
  onClick: () => void;
}) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">{title}</div>
          <Icon className="h-4 w-4 text-amber-300" />
        </div>
        <p className="text-sm leading-6 text-slate-300">{description}</p>
        <Button className="w-full" onClick={onClick}>
          Queue action
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
