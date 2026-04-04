import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Music4, PlayCircle, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    detailQuery.data?.summary.thumbnailUrl || imageFiles[0]?.url || undefined;
  const totalPages = Math.max(
    1,
    Math.ceil((libraryQuery.data?.total ?? 0) / 24),
  );

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          媒体库
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          浏览并播放已下载作品
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          这个页面替代了旧的 `listen` 页面：本地浏览、播放、封面预览、字幕匹配和原始文件访问都在这里完成。
        </p>
      </header>

      <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
        <CardContent>
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="按标题或 RJ 编号搜索本地媒体库..."
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
          {libraryQuery.data?.items.map((work) => (
            <Card
              key={work.id}
              className="cursor-pointer border-white/10 bg-white/6 backdrop-blur-xl transition hover:border-amber-400/40"
              onClick={() => setSelectedId(work.id)}
            >
              <CardContent className="space-y-4">
                {work.thumbnailUrl ? (
                  <img
                    src={work.thumbnailUrl}
                    alt={work.title}
                    className="h-40 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-2xl bg-white/5 text-sm text-slate-500">
                    暂无封面
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-amber-300">
                    {work.mediaId}
                  </div>
                  <h3 className="line-clamp-2 text-lg font-semibold text-white">
                    {work.title}
                  </h3>
                  <div className="text-sm text-slate-400">{work.releaseDate}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <MiniStat icon={FolderOpen} value={String(work.fileCount)} label="文件" />
                  <MiniStat icon={Music4} value={String(work.audioFileCount)} label="音频" />
                  <MiniStat
                    icon={Subtitles}
                    value={String(work.subtitleCount)}
                    label="字幕"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          {libraryQuery.data && libraryQuery.data.items.length === 0 && (
            <Card className="border-white/10 bg-white/6 backdrop-blur-xl lg:col-span-2">
              <CardContent className="py-10 text-center text-sm text-slate-400">
                当前搜索条件下没有匹配的本地作品。
              </CardContent>
            </Card>
          )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-400">
            <span>
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

        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>播放器与详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedId && (
              <p className="text-sm text-slate-500">
                选择一个已下载作品后，可以查看文件并开始播放。
              </p>
            )}

            {detailQuery.data && (
              <>
                <div className="space-y-3">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={detailQuery.data.summary.title}
                    className="h-48 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl bg-white/5 text-sm text-slate-500">
                      暂无封面
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="text-sm text-amber-300">
                      {detailQuery.data.summary.mediaId}
                    </div>
                    <div className="text-xl font-semibold text-white">
                      {detailQuery.data.summary.title}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <MiniStat
                    icon={FolderOpen}
                    value={String(detailQuery.data.summary.fileCount)}
                    label="文件"
                  />
                  <MiniStat
                    icon={Music4}
                    value={String(detailQuery.data.summary.audioFileCount)}
                    label="音频"
                  />
                  <MiniStat
                    icon={Subtitles}
                    value={String(detailQuery.data.summary.subtitleCount)}
                    label="字幕"
                  />
                </div>

                <div className="space-y-3">
                  <div className="text-sm text-slate-500">播放器</div>
                  {selectedAudio ? (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                          <PlayCircle className="h-4 w-4 text-amber-300" />
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
                      </div>
                      <div className="text-xs text-slate-500">
                        {selectedSubtitle
                          ? `字幕轨：${selectedSubtitle.name}`
                          : "没有找到和当前音频匹配的字幕文件。"}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-500">
                      当前作品未找到可播放音频文件。
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-slate-500">播放列表</div>
                  <div className="space-y-2">
                    {audioFiles.map((file, index) => (
                      <button
                        key={file.path}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition ${
                          selectedAudioPath === file.path
                            ? "border-amber-400/40 bg-amber-400/10 text-white"
                            : "border-white/10 bg-white/5 text-slate-300 hover:border-amber-400/30"
                        }`}
                        onClick={() => setSelectedAudioPath(file.path)}
                      >
                        <span className="text-xs text-slate-500">{index + 1}</span>
                        <span className="truncate">{file.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-slate-500">全部文件</div>
                  <div className="space-y-2">
                    {detailQuery.data.files.map((file) => (
                      <a
                        key={file.path}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300 transition hover:border-amber-400/40 hover:text-white"
                      >
                        <div>{file.name}</div>
                        <div className="text-xs text-slate-500">{file.kind}</div>
                      </a>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function findSubtitleForAudio(files: LibraryFile[], audioFile: LibraryFile) {
  const exactVtt = files.find((file) => file.path === `${audioFile.path}.vtt`);
  if (exactVtt) {
    return exactVtt;
  }

  const basename = audioFile.path.replace(/\.[^.]+$/, "");
  return files.find(
    (file) =>
      file.kind === "subtitle" &&
      file.path.replace(/\.[^.]+$/, "") === basename,
  );
}

function playNextAudio(
  files: LibraryFile[],
  currentPath: string,
  onSelect: (path: string) => void,
) {
  const index = files.findIndex((file) => file.path === currentPath);
  if (index >= 0 && index + 1 < files.length) {
    onSelect(files[index + 1].path);
  }
}
