import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { FolderOpen, MusicNotes, Subtitles } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useGlobalPlayer } from "@/components/GlobalPlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  PageHeader,
  RouteFeedback,
  fadeUpItem,
  staggerContainer,
} from "@/components/ui/sweet";
import { apiClient } from "@/lib/api";

const routeApi = getRouteApi("/library");

export function Library() {
  const routeSearch = routeApi.useSearch();
  const navigate = useNavigate({ from: "/library" });
  const player = useGlobalPlayer();
  const [searchInput, setSearchInput] = useState(routeSearch.q);
  const search = routeSearch.q;
  const page = routeSearch.page;
  const selectedId = routeSearch.id;

  const libraryQuery = useQuery({
    queryKey: ["library", search, page],
    queryFn: () => apiClient.getLibraryWorks({ search, page, pageSize: 24 }),
  });

  const detailQuery = useQuery({
    queryKey: ["library", "detail", selectedId],
    queryFn: () => apiClient.getLibraryWork(selectedId),
    enabled: selectedId.length > 0,
  });

  const audioFiles = useMemo(
    () => detailQuery.data?.files.filter((file) => file.kind === "audio") ?? [],
    [detailQuery.data],
  );
  const imageFiles = useMemo(
    () => detailQuery.data?.files.filter((file) => file.kind === "image") ?? [],
    [detailQuery.data],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = searchInput.trim();
      if (nextQuery !== routeSearch.q) {
        void navigate({ search: { ...routeSearch, q: nextQuery, page: 1 } });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [navigate, routeSearch, searchInput]);

  useEffect(() => setSearchInput(routeSearch.q), [routeSearch.q]);

  const subtitleFiles = useMemo(
    () => detailQuery.data?.files.filter((file) => file.kind === "subtitle") ?? [],
    [detailQuery.data],
  );
  const coverUrl =
    detailQuery.data?.summary.thumbnail_url || imageFiles[0]?.url || undefined;
  const totalPages = Math.max(1, Math.ceil((libraryQuery.data?.total ?? 0) / 24));

  if (libraryQuery.isError) {
    return (
      <RouteFeedback
        tone="halt"
        title="本地媒体库加载失败"
        description={`没有拿到本地作品列表。请确认后端服务正在运行，或检查媒体库目录。${libraryQuery.error ? `错误信息：${formatErrorMessage(libraryQuery.error)}` : ""}`}
        action={
          <Button variant="secondary" onClick={() => void libraryQuery.refetch()}>
            重新加载媒体库
          </Button>
        }
      />
    );
  }

  return (
    <motion.section
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="媒体库"
          title="本地媒体库"
          description="浏览已下载作品，播放音频，查看字幕和文件。"
          meta={
            <div className="deck-screen min-w-[12rem] p-4">
              <Badge variant="signal">本地作品 {libraryQuery.data?.total ?? 0}</Badge>
              <div className="console-readout mt-3 text-xl">{page} / {totalPages}</div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card foil>
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="按标题或 RJ 编号搜索本地媒体库..."
              className="flex-1"
            />
            <Badge variant="warn">PAGE SIZE 24</Badge>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUpItem} className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-4">
          <motion.div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {libraryQuery.data?.items.map((work, index) => (
              <motion.div key={work.id} variants={fadeUpItem} transition={{ delay: index * 0.02 }}>
                <Card
                  interactive
                  foil={selectedId === work.id}
                  className={selectedId === work.id ? "border-[color:var(--tape-pink)]" : undefined}
                  onClick={() => void navigate({ search: { ...routeSearch, id: work.id } })}
                >
                  <CardContent className="flex h-full flex-col gap-4 p-4">
                    <div className="deck-screen aspect-[4/3]">
                      {work.thumbnail_url ? (
                        <img
                          src={work.thumbnail_url}
                          alt={work.title}
                          className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:brightness-110"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[color:var(--text-mute)]">
                          NO COVER
                        </div>
                      )}
                      <div className="absolute bottom-3 left-3">
                        <Badge variant="warn">{work.media_id}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="console-title line-clamp-2 text-xl font-black leading-7 text-[color:var(--text-display)]">
                        {work.title}
                      </h3>
                      <div className="console-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
                        {work.release_date || "NO DATE"}
                      </div>
                    </div>

                    <div className="deck-decal justify-between">
                      <span>ASMRoner</span>
                      <span>TYPE-II</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat icon={FolderOpen} value={String(work.file_count)} label="FILES" />
                      <MiniStat icon={MusicNotes} value={String(work.audio_file_count)} label="AUDIO" />
                      <MiniStat icon={Subtitles} value={String(work.subtitle_count)} label="SUB" />
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2">
                      <Badge variant="decal">TAPE CASE</Badge>
                      {work.has_subtitles ? (
                        <Badge variant="signal">CC READY</Badge>
                      ) : (
                        <Badge variant="mute">NO CC</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {libraryQuery.data && libraryQuery.data.items.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent>
                  <EmptyState
                    symbol="无数据"
                    title="没有匹配作品"
                    description="当前搜索条件下没有匹配的本地作品。去搜索作品页把喜欢的作品下载进来，这里就会慢慢变满。"
                  />
                </CardContent>
              </Card>
            )}
          </motion.div>

          <div className="deck-plate flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-[color:var(--text-body)]">
              第 {page} / {totalPages} 页，共 {libraryQuery.data?.total ?? 0} 个作品
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => void navigate({ search: { ...routeSearch, page: page - 1 } })}
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => void navigate({ search: { ...routeSearch, page: page + 1 } })}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>

        <Card foil className="h-fit overflow-hidden xl:sticky xl:top-28">
          <CardHeader>
            <CardTitle>播放器与作品详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedId && (
              <EmptyState
                symbol="请选择"
                title="选择本地作品"
                description="选中左侧任意作品后，这里会显示封面、播放列表、字幕轨和全部文件。"
                className="min-h-[16rem]"
              />
            )}

            {detailQuery.data && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat
                    icon={FolderOpen}
                    value={String(detailQuery.data.summary.file_count)}
                    label="FILES"
                  />
                  <MiniStat
                    icon={MusicNotes}
                    value={String(detailQuery.data.summary.audio_file_count)}
                    label="AUDIO"
                  />
                  <MiniStat
                    icon={Subtitles}
                    value={String(detailQuery.data.summary.subtitle_count)}
                    label="SUB"
                  />
                </div>

                <div className="space-y-3">
                  <div className="deck-decal">PLAYLIST</div>
                  <div className="space-y-2">
                    {audioFiles.map((file, index) => (
                      <button
                        key={file.path}
                        className={`deck-plate flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition ${
                          player.activeMediaId === detailQuery.data.summary.media_id && player.selectedPath === file.path
                            ? "border-[color:var(--tape-pink)] text-[color:var(--text-display)] shadow-[var(--glow-tape)]"
                            : "text-[color:var(--text-body)] hover:border-[color:var(--telltale-amber)]"
                        }`}
                        onClick={() => player.play({
                          tracks: audioFiles,
                          subtitles: subtitleFiles,
                          title: detailQuery.data.summary.title,
                          mediaId: detailQuery.data.summary.media_id,
                          coverUrl,
                        }, file.path)}
                      >
                        <Badge variant={player.activeMediaId === detailQuery.data.summary.media_id && player.selectedPath === file.path ? "live" : "mute"}>
                          {String(index + 1).padStart(2, "0")}
                        </Badge>
                        <span className="truncate">{file.name}</span>
                      </button>
                    ))}
                    {audioFiles.length === 0 ? (
                      <div className="deck-screen p-4 text-sm text-[color:var(--text-mute)]">
                        当前作品未找到可播放音频文件。
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="deck-decal">FILE DRAWER</div>
                  <div className="space-y-2">
                    {detailQuery.data.files.map((file) => (
                      <a
                        key={file.path}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="deck-plate block p-3 text-sm transition hover:border-[color:var(--telltale-amber)]"
                      >
                        <div className="font-medium text-[color:var(--text-display)]">{file.name}</div>
                        <div className="mt-1 text-xs text-[color:var(--text-mute)]">{file.kind}</div>
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.section>
  );
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: Icon;
  value: string;
  label: string;
}) {
  return (
    <div className="deck-screen px-3 py-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
        <Icon className="h-3.5 w-3.5" weight="duotone" />
        {label}
      </div>
      <div className="console-readout mt-2 text-sm">{value}</div>
    </div>
  );
}
