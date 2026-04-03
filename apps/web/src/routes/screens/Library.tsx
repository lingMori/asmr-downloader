import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Music4, PlayCircle, Subtitles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient, type LibraryFile } from "@/lib/api";

export function Library() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedAudioPath, setSelectedAudioPath] = useState("");

  const libraryQuery = useQuery({
    queryKey: ["library", search],
    queryFn: () => apiClient.getLibraryWorks({ search, page: 1, pageSize: 24 }),
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

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Library
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Browse and play downloaded works
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          This screen replaces the old `listen` page: local browsing, playback,
          cover preview, captions, and raw file access all live here now.
        </p>
      </header>

      <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
        <CardContent>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search local library by title or RJ ID..."
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
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
                    No cover
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
                  <MiniStat icon={FolderOpen} value={String(work.fileCount)} label="Files" />
                  <MiniStat icon={Music4} value={String(work.audioFileCount)} label="Audio" />
                  <MiniStat
                    icon={Subtitles}
                    value={String(work.subtitleCount)}
                    label="Subs"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-white/10 bg-white/6 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Player & detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedId && (
              <p className="text-sm text-slate-500">
                Pick a downloaded work to inspect files and start playback.
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
                      No cover
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
                    label="Files"
                  />
                  <MiniStat
                    icon={Music4}
                    value={String(detailQuery.data.summary.audioFileCount)}
                    label="Audio"
                  />
                  <MiniStat
                    icon={Subtitles}
                    value={String(detailQuery.data.summary.subtitleCount)}
                    label="Subs"
                  />
                </div>

                <div className="space-y-3">
                  <div className="text-sm text-slate-500">Player</div>
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
                          ? `Caption track: ${selectedSubtitle.name}`
                          : "No caption track matched to the selected audio file."}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-500">
                      No audio file found in this work.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-slate-500">Playlist</div>
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
                  <div className="text-sm text-slate-500">All files</div>
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
