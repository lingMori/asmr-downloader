import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Activity, Clock3, DownloadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import { useTaskEvents } from "@/lib/useTaskEvents";

export function Queue() {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => apiClient.getTasks(),
    refetchInterval: 15000,
  });
  const taskDetailQuery = useQuery({
    queryKey: ["task", selectedTaskId],
    queryFn: () => apiClient.getTask(selectedTaskId as number),
    enabled: typeof selectedTaskId === "number" && Number.isFinite(selectedTaskId),
  });

  useTaskEvents(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (selectedTaskId !== null) {
      queryClient.invalidateQueries({ queryKey: ["task", selectedTaskId] });
    }
  });

  const summary = useMemo(() => {
    const items = tasksQuery.data?.items ?? [];
    return {
      running: items.filter((item) => item.status === "RUNNING").length,
      failed: items.filter((item) => item.status === "FAILED").length,
      total: items.length,
    };
  }, [tasksQuery.data]);

  if (tasksQuery.isLoading) {
    return <div className="text-slate-400">Loading queue...</div>;
  }

  if (tasksQuery.isError) {
    return <div className="text-rose-300">Failed to load queue.</div>;
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Queue
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Track downloads and sync jobs
        </h1>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Clock3} label="Running" value={summary.running} />
        <MetricCard icon={Activity} label="Failed" value={summary.failed} />
        <MetricCard icon={DownloadCloud} label="Visible jobs" value={summary.total} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>ID</TableHeaderCell>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Progress</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {tasksQuery.data?.items.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <TableCell>{task.id}</TableCell>
                      <TableCell className="text-slate-200">{task.name}</TableCell>
                      <TableCell className="text-slate-400">{task.type}</TableCell>
                      <TableCell>
                        <Badge>{task.status}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {Math.round((task.progress ?? 0) * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Job detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedTaskId && (
              <p className="text-sm text-slate-500">
                Pick a job to inspect payload, result, and logs.
              </p>
            )}
            {taskDetailQuery.isLoading && (
              <p className="text-sm text-slate-500">Loading job detail...</p>
            )}
            {taskDetailQuery.data && (
              <>
                <Summary label="Message" value={taskDetailQuery.data.message || "-"} />
                <Summary label="Source" value={taskDetailQuery.data.source || "-"} />
                <Summary
                  label="Created"
                  value={taskDetailQuery.data.createdAt || "-"}
                />
                <CodeBlock title="Payload" value={taskDetailQuery.data.payload || "{}"} />
                <CodeBlock title="Result" value={taskDetailQuery.data.result || "{}"} />
                <div className="space-y-2">
                  <div className="text-sm text-slate-500">Logs</div>
                  <div className="space-y-2">
                    {(taskDetailQuery.data.logs ?? []).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300"
                      >
                        {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-sm">{label}</span>
          <Icon className="h-4 w-4 text-amber-300" />
        </div>
        <div className="text-3xl font-semibold text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}

function CodeBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="text-slate-500">{title}</div>
      <pre className="overflow-auto rounded-2xl bg-slate-950/60 p-3 text-xs text-slate-300">
        {value}
      </pre>
    </div>
  );
}
