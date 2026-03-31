import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FolderOpen, Music4, Subtitles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";

export function Library() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const libraryQuery = useQuery({
    queryKey: ["library", search],
    queryFn: () => apiClient.getLibraryWorks({ search, page: 1, pageSize: 24 }),
  });

  const detailQuery = useQuery({
    queryKey: ["library", "detail", selectedId],
    queryFn: () => apiClient.getLibraryWork(selectedId),
    enabled: selectedId.length > 0,
  });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-300">
          Library
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Browse downloaded works
        </h1>
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

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4 lg:grid-cols-2">
          {libraryQuery.data?.items.map((work) => (
            <Card
              key={work.id}
              className="cursor-pointer border-white/10 bg-white/6 backdrop-blur-xl"
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
            <CardTitle>Local detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedId && (
              <p className="text-sm text-slate-500">
                Pick a downloaded work to inspect local files.
              </p>
            )}
            {detailQuery.data && (
              <>
                <div className="space-y-1">
                  <div className="text-sm text-slate-500">Title</div>
                  <div className="text-lg font-semibold text-white">
                    {detailQuery.data.summary.title}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-500">Files</div>
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
