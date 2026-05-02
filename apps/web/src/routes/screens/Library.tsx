import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Music4, PlayCircle, Subtitles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  PageHeader,
  fadeUpItem,
  staggerContainer,
} from "@/components/ui/sweet";
import { apiClient, type LibraryFile } from "@/lib/api";

export function Library() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [selectedAudioPath, setSelectedAudioPath] = useState("");

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
    if (!detailQuery.data) {
      setSelectedAudioPath("");
      return;
    }

    if (!selectedAudioPath || !audioFiles.some((file) => file.path === selectedAudioPath)) {
      setSelectedAudioPath(audioFiles[0]?.path ?? "");
    }
  }, [audioFiles, detailQuery.data, selectedAudioPath]);

  const selectedAudio = audioFiles.find((file) => file.path === selectedAudioPath);
  const selectedSubtitle = selectedAudio
    ? findSubtitleForAudio(detailQuery.data?.files ?? [], selectedAudio)
    : undefined;
  const coverUrl =
    detailQuery.data?.summary.thumbnail_url || imageFiles[0]?.url || undefined;
  const totalPages = Math.max(1, Math.ceil((libraryQuery.data?.total ?? 0) / 24));

  return (
    <motion.section
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUpItem}>
        <PageHeader
          kicker="Library"
          title="媒体档案库与监听台"
          description="这里替代旧的 listen 页面。雷达墙负责浏览和筛选，右侧终端面板负责播放、字幕匹配和文件访问。"
          meta={
            <div className="space-y-3 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4 shadow-[var(--shadow-glass)]">
              <Badge variant="mint">本地作品 {libraryQuery.data?.total ?? 0}</Badge>
              <div className="text-sm leading-6 text-[color:var(--text-body)]">
                当前页 <span className="font-semibold">{page}</span> / {totalPages}
              </div>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={fadeUpItem}>
        <Card foil>
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="按标题或 RJ 编号搜索本地媒体库..."
              className="flex-1"
            />
            <Badge variant="blue">页内展示 24 项</Badge>
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
                  foil
                  className={
                    selectedId === work.id
                      ? "border-[color:var(--panel-border-strong)] bg-[color:var(--interactive-bg-strong)]"
                      : undefined
                  }
                  onClick={() => setSelectedId(work.id)}
                >
                  <CardContent className="flex h-full flex-col gap-4 p-4">
                    <div className="relative overflow-hidden rounded-lg">
                      {work.thumbnail_url ? (
                        <img
                          src={work.thumbnail_url}
                          alt={work.title}
                          className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-52 items-center justify-center bg-[color:var(--interactive-bg)] text-sm text-[color:var(--text-muted)]">
                          暂无封面
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(25,10,24,0.42)] via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3">
                        <Badge variant="gold">{work.media_id}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="line-clamp-2 text-lg font-semibold text-[color:var(--text-strong)]">
                        {work.title}
                      </h3>
                      <div className="text-sm text-[color:var(--text-body)]">{work.release_date}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat icon={FolderOpen} value={String(work.file_count)} label="文件" />
                      <MiniStat icon={Music4} value={String(work.audio_file_count)} label="音频" />
                      <MiniStat
                        icon={Subtitles}
                        value={String(work.subtitle_count)}
                        label="字幕"
                      />
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2">
                      <Badge variant="pink">收藏卡</Badge>
                      {work.has_subtitles ? (
                        <Badge variant="mint">已配字幕</Badge>
                      ) : (
                        <Badge variant="ghost">暂无字幕</Badge>
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
                    symbol="NO DATA"
                    title="这里还没有收藏落地"
                    description="当前搜索条件下没有匹配的本地作品。去发现页把喜欢的作品拉进来，这里就会慢慢变满。"
                  />
                </CardContent>
              </Card>
            )}
          </motion.div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] px-4 py-3">
            <span className="text-sm text-[color:var(--text-body)]">
              第 {page} / {totalPages} 页，共 {libraryQuery.data?.total ?? 0} 个作品
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>

        <Card foil className="h-fit overflow-hidden xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="text-base">播放器与作品详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedId && (
              <EmptyState
                symbol="MONITOR"
                title="选择媒体档案"
                description="选中左侧任意作品后，这里会显示封面、播放列表、字幕轨和全部文件。"
                className="min-h-[28rem]"
              />
            )}

            {detailQuery.data && (
              <>
                <div className="space-y-4">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={detailQuery.data.summary.title}
                      className="h-60 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-60 items-center justify-center rounded-lg bg-[color:var(--interactive-bg)] text-sm text-[color:var(--text-muted)]">
                      暂无封面
                    </div>
                  )}

                  <div className="space-y-2">
                    <Badge variant="gold">{detailQuery.data.summary.media_id}</Badge>
                    <div className="text-2xl font-semibold text-[color:var(--text-strong)]">
                      {detailQuery.data.summary.title}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <MiniStat
                    icon={FolderOpen}
                    value={String(detailQuery.data.summary.file_count)}
                    label="文件"
                  />
                  <MiniStat
                    icon={Music4}
                    value={String(detailQuery.data.summary.audio_file_count)}
                    label="音频"
                  />
                  <MiniStat
                    icon={Subtitles}
                    value={String(detailQuery.data.summary.subtitle_count)}
                    label="字幕"
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[color:var(--text-body)]">
                      当前播放器
                    </div>
                    <div className="visualizer h-6">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <span key={index} className="visualizer-dot" style={{ width: "0.55rem" }} />
                      ))}
                    </div>
                  </div>
                  {selectedAudio ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-[color:var(--text-strong)]">
                        <PlayCircle className="h-4 w-4 text-[color:var(--accent-rose)]" />
                        {selectedAudio.name}
                      </div>
                      <audio
                        key={selectedAudio.url}
                        controls
                        autoPlay
                        className="w-full"
                        onEnded={() =>
                          playNextAudio(audioFiles, selectedAudio.path, setSelectedAudioPath)
                        }
                      >
                        <source src={selectedAudio.url} />
                        {selectedSubtitle && (
                          <track
                            kind="captions"
                            label="Captions"
                            srcLang="zh"
                            src={selectedSubtitle.url}
                            default
                          />
                        )}
                      </audio>
                      <div className="text-xs text-[color:var(--text-muted)]">
                        {selectedSubtitle
                          ? `字幕轨：${selectedSubtitle.name}`
                          : "没有找到和当前音频匹配的字幕文件。"}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-4 text-sm text-[color:var(--text-muted)]">
                      当前作品未找到可播放音频文件。
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[color:var(--text-body)]">播放列表</div>
                  <div className="space-y-2">
                    {audioFiles.map((file, index) => (
                      <button
                        key={file.path}
                        className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left text-sm transition ${
                          selectedAudioPath === file.path
                            ? "border-[color:var(--panel-border-strong)] bg-[color:var(--interactive-bg-strong)] text-[color:var(--text-strong)]"
                            : "border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] text-[color:var(--text-body)] hover:bg-[color:var(--interactive-bg-strong)]"
                        }`}
                        onClick={() => setSelectedAudioPath(file.path)}
                      >
                        <Badge variant={selectedAudioPath === file.path ? "pink" : "ghost"}>
                          {index + 1}
                        </Badge>
                        <span className="truncate">{file.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[color:var(--text-body)]">全部文件</div>
                  <div className="space-y-2">
                    {detailQuery.data.files.map((file) => (
                      <a
                        key={file.path}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] p-3 text-sm transition hover:-translate-y-0.5 hover:bg-[color:var(--interactive-bg-strong)]"
                      >
                        <div className="font-medium text-[color:var(--text-strong)]">{file.name}</div>
                        <div className="mt-1 text-xs text-[color:var(--text-muted)]">{file.kind}</div>
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

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof FolderOpen;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-md border border-[color:var(--panel-border)] bg-[color:var(--interactive-bg)] px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[color:var(--text-strong)]">{value}</div>
    </div>
  );
}

function findSubtitleForAudio(files: LibraryFile[], audioFile: LibraryFile) {
  const baseName = audioFile.name.replace(/\.[^.]+$/, "");
  return files.find(
    (file) =>
      file.kind === "subtitle" &&
      (file.name.startsWith(baseName) || file.path.replace(/\.[^.]+$/, "") === audioFile.path.replace(/\.[^.]+$/, "")),
  );
}

function playNextAudio(
  audioFiles: LibraryFile[],
  currentPath: string,
  onSelect: (path: string) => void,
) {
  const currentIndex = audioFiles.findIndex((file) => file.path === currentPath);
  if (currentIndex >= 0 && currentIndex < audioFiles.length - 1) {
    onSelect(audioFiles[currentIndex + 1].path);
  }
}
