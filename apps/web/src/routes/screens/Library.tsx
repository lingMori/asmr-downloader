import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  ArrowSquareOut,
  FolderOpen,
  GridFour,
  ListBullets,
  MagnifyingGlass,
  MusicNotes,
  Play,
  Subtitles,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useGlobalPlayer } from "@/components/GlobalPlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, RouteFeedback } from "@/components/ui/sweet";
import { apiClient } from "@/lib/api";

const routeApi = getRouteApi("/library");

type LibraryView = "grid" | "list";

export function Library() {
  const routeSearch = routeApi.useSearch();
  const navigate = useNavigate({ from: "/library" });
  const player = useGlobalPlayer();
  const [searchInput, setSearchInput] = useState(routeSearch.q);
  const [view, setView] = useState<LibraryView>("grid");
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
  const subtitleFiles = useMemo(
    () => detailQuery.data?.files.filter((file) => file.kind === "subtitle") ?? [],
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

  const coverUrl =
    detailQuery.data?.summary.thumbnail_url || imageFiles[0]?.url || undefined;
  const totalPages = Math.max(1, Math.ceil((libraryQuery.data?.total ?? 0) / 24));
  const isSelectedTrack = (path: string) =>
    player.activeMediaId === detailQuery.data?.summary.media_id &&
    player.selectedPath === path;

  const playTrack = (path: string) => {
    if (!detailQuery.data) return;
    player.play(
      {
        tracks: audioFiles,
        subtitles: subtitleFiles,
        title: detailQuery.data.summary.title,
        mediaId: detailQuery.data.summary.media_id,
        coverUrl,
      },
      path,
    );
  };

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
    <section className="space-y-4">
      <PageHeader
        kicker="媒体库"
        title="本地媒体库"
        description="浏览已下载作品，播放音频，查看字幕和文件。"
        meta={
          <div className="flex items-center gap-3 text-sm text-[color:var(--text-body)]">
            <Badge variant="signal">本地作品 {libraryQuery.data?.total ?? 0}</Badge>
            <span className="console-mono whitespace-nowrap">
              {page} / {totalPages} 页
            </span>
          </div>
        }
      />

      <div className="deck-chassis flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <MagnifyingGlass
            className="h-5 w-5 shrink-0 text-[color:var(--text-mute)]"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="按标题或 RJ 编号搜索本地媒体库..."
            aria-label="搜索本地媒体库"
            className="flex-1"
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-[color:var(--text-mute)]">每页 24 项</span>
          <div className="flex gap-1" role="group" aria-label="媒体库视图">
            <Button
              type="button"
              variant={view === "grid" ? "primary" : "ghost"}
              size="sm"
              className="h-9 w-9 px-0"
              aria-label="封面网格"
              title="封面网格"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <GridFour className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "primary" : "ghost"}
              size="sm"
              className="h-9 w-9 px-0"
              aria-label="紧凑列表"
              title="紧凑列表"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <ListBullets className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-4">
          <div
            className={
              view === "grid"
                ? "grid gap-3 sm:grid-cols-2 2xl:grid-cols-3"
                : "grid gap-2"
            }
          >
            {libraryQuery.isLoading ? (
              <div
                className={`border border-[color:var(--chassis-edge)] p-8 text-center text-sm text-[color:var(--text-mute)] ${
                  view === "grid" ? "sm:col-span-2 2xl:col-span-3" : ""
                }`}
                aria-live="polite"
              >
                正在读取本地媒体库...
              </div>
            ) : null}

            {libraryQuery.data?.items.map((work) => {
              const selected = selectedId === work.id;
              const selectedHasAudio =
                selected && detailQuery.data && audioFiles.length > 0;

              return (
                <Card
                  key={work.id}
                  className={
                    selected
                      ? "border-[color:var(--tape-pink)] bg-[color:var(--surface-elevated)]"
                      : undefined
                  }
                >
                  <CardContent
                    className={
                      view === "grid"
                        ? "flex h-full flex-col gap-3 p-3"
                        : "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center"
                    }
                  >
                    <button
                      type="button"
                      className="relative aspect-square w-full overflow-hidden border border-[color:var(--chassis-edge)] bg-[color:var(--surface-inset)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tape-pink)]"
                      aria-label={`查看 ${work.title}`}
                      aria-pressed={selected}
                      onClick={() =>
                        void navigate({ search: { ...routeSearch, id: work.id } })
                      }
                    >
                      {work.thumbnail_url ? (
                        <img
                          src={work.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-[color:var(--text-mute)]">
                          暂无封面
                        </span>
                      )}
                      <span className="absolute bottom-2 left-2">
                        <Badge variant="mute" className="bg-[color:var(--surface-overlay)]">
                          {work.media_id}
                        </Badge>
                      </span>
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <button
                        type="button"
                        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tape-pink)]"
                        onClick={() =>
                          void navigate({ search: { ...routeSearch, id: work.id } })
                        }
                      >
                        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--text-display)]">
                          {work.title}
                        </h3>
                        <span className="console-mono mt-1 block text-xs text-[color:var(--text-mute)]">
                          {work.release_date || "日期未知"}
                        </span>
                      </button>

                      <div className="mt-auto grid grid-cols-3 gap-2">
                        <MiniStat icon={FolderOpen} value={String(work.file_count)} label="文件" />
                        <MiniStat icon={MusicNotes} value={String(work.audio_file_count)} label="音频" />
                        <MiniStat icon={Subtitles} value={String(work.subtitle_count)} label="字幕" />
                      </div>
                    </div>

                    {view === "list" ? (
                      <div className="col-span-2 flex justify-end sm:col-span-1">
                        {selectedHasAudio ? (
                          <Button size="sm" onClick={() => playTrack(audioFiles[0].path)}>
                            <Play className="h-4 w-4" weight="fill" />
                            播放
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={selected ? "secondary" : "ghost"}
                            onClick={() =>
                              void navigate({ search: { ...routeSearch, id: work.id } })
                            }
                          >
                            查看
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}

            {libraryQuery.data && libraryQuery.data.items.length === 0 ? (
              <div className={view === "grid" ? "sm:col-span-2 2xl:col-span-3" : undefined}>
                <EmptyState
                  symbol="无数据"
                  title="没有匹配作品"
                  description="当前搜索条件下没有匹配的本地作品。去搜索作品页下载作品后会显示在这里。"
                  className="min-h-[14rem]"
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--chassis-edge)] pt-3">
            <span className="text-sm text-[color:var(--text-body)]">
              第 {page} / {totalPages} 页，共 {libraryQuery.data?.total ?? 0} 个作品
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  void navigate({ search: { ...routeSearch, page: page - 1 } })
                }
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() =>
                  void navigate({ search: { ...routeSearch, page: page + 1 } })
                }
              >
                下一页
              </Button>
            </div>
          </div>
        </div>

        <Card className="h-fit xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle>作品详情与播放</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedId ? (
              <EmptyState
                symbol="请选择"
                title="选择本地作品"
                description="选中任意作品后，这里会显示封面、播放列表、字幕轨和全部文件。"
                className="min-h-[14rem]"
              />
            ) : null}

            {selectedId && detailQuery.isLoading ? (
              <div className="py-12 text-center text-sm text-[color:var(--text-mute)]">
                正在读取作品文件...
              </div>
            ) : null}

            {detailQuery.isError ? (
              <div className="space-y-3 border border-[color:var(--telltale-red)] p-4 text-sm text-[color:var(--text-body)]">
                <p>作品详情加载失败：{formatErrorMessage(detailQuery.error)}</p>
                <Button size="sm" variant="secondary" onClick={() => void detailQuery.refetch()}>
                  重新加载详情
                </Button>
              </div>
            ) : null}

            {detailQuery.data ? (
              <>
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
                  <div className="aspect-square overflow-hidden border border-[color:var(--chassis-edge)] bg-[color:var(--surface-inset)]">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={detailQuery.data.summary.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-[color:var(--text-mute)]">
                        暂无封面
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Badge variant="mute">{detailQuery.data.summary.media_id}</Badge>
                    <h2 className="line-clamp-3 text-base font-semibold leading-6 text-[color:var(--text-display)]">
                      {detailQuery.data.summary.title}
                    </h2>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={audioFiles.length === 0}
                      onClick={() => audioFiles[0] && playTrack(audioFiles[0].path)}
                    >
                      <Play className="h-4 w-4" weight="fill" />
                      播放首曲
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-y border-[color:var(--chassis-edge)] py-3">
                  <MiniStat
                    icon={FolderOpen}
                    value={String(detailQuery.data.summary.file_count)}
                    label="文件"
                  />
                  <MiniStat
                    icon={MusicNotes}
                    value={String(detailQuery.data.summary.audio_file_count)}
                    label="音频"
                  />
                  <MiniStat
                    icon={Subtitles}
                    value={String(detailQuery.data.summary.subtitle_count)}
                    label="字幕"
                  />
                </div>

                <section className="space-y-2" aria-labelledby="library-playlist-title">
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="library-playlist-title" className="text-sm font-semibold text-[color:var(--text-display)]">
                      播放列表
                    </h3>
                    <span className="text-xs text-[color:var(--text-mute)]">{audioFiles.length} 首</span>
                  </div>
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {audioFiles.map((file, index) => (
                      <button
                        key={file.path}
                        type="button"
                        className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tape-pink)] ${
                          isSelectedTrack(file.path)
                            ? "border-[color:var(--tape-pink)] bg-[color:var(--surface-elevated)] text-[color:var(--text-display)]"
                            : "border-[color:var(--chassis-edge)] text-[color:var(--text-body)] hover:bg-[color:var(--surface-elevated)]"
                        }`}
                        onClick={() => playTrack(file.path)}
                      >
                        <Play className="h-4 w-4 shrink-0" weight={isSelectedTrack(file.path) ? "fill" : "regular"} />
                        <span className="console-mono w-5 shrink-0 text-xs text-[color:var(--text-mute)]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate">{file.name}</span>
                      </button>
                    ))}
                    {audioFiles.length === 0 ? (
                      <div className="border border-[color:var(--chassis-edge)] p-3 text-sm text-[color:var(--text-mute)]">
                        当前作品未找到可播放音频文件。
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-2" aria-labelledby="library-files-title">
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="library-files-title" className="text-sm font-semibold text-[color:var(--text-display)]">
                      全部文件
                    </h3>
                    <span className="text-xs text-[color:var(--text-mute)]">
                      {detailQuery.data.files.length} 项
                    </span>
                  </div>
                  <div className="max-h-72 divide-y divide-[color:var(--chassis-edge)] overflow-y-auto border border-[color:var(--chassis-edge)]">
                    {detailQuery.data.files.map((file) => (
                      <a
                        key={file.path}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-[color:var(--surface-elevated)]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[color:var(--text-display)]">{file.name}</span>
                          <span className="mt-0.5 block text-xs text-[color:var(--text-mute)]">{file.kind}</span>
                        </span>
                        <ArrowSquareOut className="h-4 w-4 shrink-0 text-[color:var(--text-mute)]" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
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
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-[color:var(--text-mute)]">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <div className="console-mono mt-1 text-sm font-semibold text-[color:var(--text-display)]">
        {value}
      </div>
    </div>
  );
}
