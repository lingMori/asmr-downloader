import { Play } from "@phosphor-icons/react";
import type { PlaybackProgress } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { useGlobalPlayer } from "@/player";
import { CoverPlaceholder, Sticker } from "@/components/ui";
import { coverColorFor } from "./coverColor";

/**
 * hero「继续收听 · つづき」(dc.html:56-69)。
 * 本地(/media/...)与远端(.../stream)进度统一入口;远端带「在线」虚线徽章。
 */
export function ContinueHero({ item }: { item: PlaybackProgress }) {
  const { playSession } = useGlobalPlayer();
  const isRemote = !item.track_path.startsWith("/media/");
  const pct =
    item.duration > 0 ? Math.min(100, Math.max(0, Math.round((item.position / item.duration) * 100))) : 0;

  const resume = () => {
    playSession(
      {
        sourceId: item.source_id,
        workTitle: item.work_title,
        coverUrl: item.cover_url || undefined,
        tracks: [{ id: "0", title: item.track_title, url: item.track_path }],
        startIndex: 0,
        stream: isRemote,
      },
      { resumeFrom: item.position },
    );
  };

  return (
    <section className="y-lib-hero" aria-label="继续收听">
      <Sticker section className="y-lib-hero__sticker">
        继续收听 · つづき
      </Sticker>
      <div className="y-lib-hero__cover">
        {item.cover_url ? (
          <img src={item.cover_url} alt={item.work_title} />
        ) : (
          <CoverPlaceholder color={coverColorFor(item.source_id)} />
        )}
      </div>
      <div className="y-lib-hero__body">
        <div className="y-lib-hero__title">{item.work_title}</div>
        <div className="y-lib-hero__meta">
          <span className="y-lib-hero__rj">{item.source_id}</span>
          <span>·</span>
          <span>{item.track_title}</span>
          <span>·</span>
          <span>
            已播 {formatDuration(item.position)}/{formatDuration(item.duration)}
          </span>
          {isRemote && <span className="y-stream-badge">在线</span>}
        </div>
        <div className="y-lib-hero__actions">
          <button type="button" className="y-btn-primary" onClick={resume}>
            <Play size={14} weight="fill" /> 继续播放
          </button>
          <div className="y-lib-hero__progress" role="presentation">
            <div className="y-lib-hero__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="y-lib-hero__pct">{pct}%</span>
        </div>
      </div>
    </section>
  );
}
