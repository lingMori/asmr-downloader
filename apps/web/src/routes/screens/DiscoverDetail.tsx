import type { ReactNode } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Globe, Tags, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, type TrackNode } from "@/lib/api";

const routeApi = getRouteApi("/discover/$sourceId");

export function DiscoverDetail() {
  const { sourceId } = routeApi.useParams();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["discover", "detail-page", sourceId],
    queryFn: () => apiClient.getDiscoverWork(sourceId),
  });

  const downloadMutation = useMutation({
    mutationFn: () =>
      apiClient.createDownload({
        mode: "single",
        ids: [sourceId],
      }),
    onSuccess: (res) => {
      toast.success(`已加入下载队列，任务 #${res.taskId}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(String(error));
    },
  });

  if (detailQuery.isLoading) {
    return <div className="text-slate-400">正在加载作品详情...</div>;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <div className="text-rose-300">作品详情加载失败。</div>;
  }

  const detail = detailQuery.data;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回作品搜索
        </Link>
        <Button onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
          <Download className="mr-2 h-4 w-4" />
          下载当前作品
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardContent className="space-y-6">
            {detail.summary.mainCoverUrl || detail.summary.thumbnailUrl ? (
              <img
                src={detail.summary.mainCoverUrl || detail.summary.thumbnailUrl}
                alt={detail.summary.title}
                className="h-72 w-full rounded-3xl object-cover"
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-3xl bg-white/5 text-sm text-slate-500">
                暂无封面
              </div>
            )}

            <div className="space-y-3">
              <div className="text-sm font-medium text-amber-300">
                {detail.summary.sourceId}
              </div>
              <h1 className="text-3xl font-semibold text-white">
                {detail.summary.title}
              </h1>
              <p className="text-sm text-slate-400">{detail.summary.circle}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <InfoStat label="发售日" value={detail.summary.release || "-"} />
              <InfoStat label="价格" value={String(detail.price)} />
              <InfoStat label="下载量" value={String(detail.summary.dlCount)} />
              <InfoStat label="评分" value={detail.summary.rate.toFixed(2)} />
              <InfoStat label="评论数" value={String(detail.reviewCount)} />
              <InfoStat label="音轨数" value={String(detail.tracks.length)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MetaBlock title="标签" icon={Tags}>
                <div className="flex flex-wrap gap-2">
                  {detail.summary.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </MetaBlock>

              <MetaBlock title="声优" icon={UserRound}>
                <div className="flex flex-wrap gap-2">
                  {detail.summary.vas.map((va) => (
                    <span
                      key={va}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                    >
                      {va}
                    </span>
                  ))}
                </div>
              </MetaBlock>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>补充信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <InfoRow label="年龄分级" value={detail.ageCategory || "-"} />
              <InfoRow label="作品属性" value={detail.workAttributes || "-"} />
              <InfoRow label="创建日期" value={detail.createDate || "-"} />
              <InfoRow label="社团 ID" value={String(detail.circleId)} />
              <a
                href={detail.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-amber-300 transition hover:text-amber-200"
              >
                <Globe className="h-4 w-4" />
                打开源站作品页
              </a>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>音轨树</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.tracks.map((track, index) => (
                <TrackTree key={`${track.title}-${index}`} node={track} depth={0} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function MetaBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Tags;
  children: ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-amber-300" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}

function TrackTree({ node, depth }: { node: TrackNode; depth: number }) {
  return (
    <div className="space-y-2">
      <div
        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200"
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="font-medium">{node.title}</div>
        <div className="mt-1 text-xs text-slate-500">{node.type}</div>
      </div>
      {node.children?.map((child, index) => (
        <TrackTree key={`${child.title}-${index}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
