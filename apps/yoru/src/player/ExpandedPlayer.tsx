import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { CoverPlaceholder, EQ, Sticker } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatTime } from "./logic";
import { pickCoverColor } from "./PlayerBar";
import { useGlobalPlayer } from "./GlobalPlayer";
import type { PlayerTrack } from "./types";
import { SPRING_SOFT, EASE_OUT } from "@/lib/motion";

/**
 * 展开播放器(原型 dc.html:475-506):
 * 桌面 = 遮罩 z40 + 底部居中浮层 z41(max 860px,左 190px 封面+字幕卡,右曲目列表);
 * 移动 = 全屏浮层纵向排布。
 */
export function ExpandedPlayer() {
  const { session, expanded, setExpanded } = useGlobalPlayer();
  const open = expanded && Boolean(session);
  return (
    <AnimatePresence>
      {open && session && (
        <div key="expanded-player" style={{ display: "contents" }}>
          <motion.div
            className="y-player-overlay"
            onClick={() => setExpanded(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          />
          <motion.div
            className="y-player-expanded"
            role="dialog"
            aria-label="播放器"
            style={{ x: "-50%" }}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={SPRING_SOFT}
          >
            <ExpandedBody />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ExpandedBody() {
  const {
    session,
    index,
    playing,
    currentTrack,
    playAt,
    setExpanded,
  } = useGlobalPlayer();
  const [queued, setQueued] = useState(false);
  const sourceId = session?.sourceId;

  useEffect(() => {
    setQueued(false);
  }, [sourceId]);

  if (!session || !currentTrack) {
    return null;
  }

  const downloadThis = () => {
    if (!sourceId || queued) {
      return;
    }
    void apiClient
      .createDownload({ mode: "single", ids: [sourceId] })
      .then(() => {
        setQueued(true);
        toast.success("已加入传输队列");
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "加入队列失败");
      });
  };

  return (
    <>
      <button
        type="button"
        className="y-player-expanded__close"
        aria-label="收起播放器"
        onClick={() => setExpanded(false)}
      >
        ✕
      </button>
      <div className="y-player-expanded__left">
        {session.coverUrl ? (
          <img className="y-player-expanded__cover" src={session.coverUrl} alt="" />
        ) : (
          <CoverPlaceholder
            className="y-player-expanded__cover"
            color={pickCoverColor(session.workTitle)}
            label="封面 · COVER"
          />
        )}
        <SubtitleCard track={currentTrack} />
      </div>
      <div className="y-player-expanded__right">
        <div className="y-player-expanded__badges">
          <Sticker className="y-sticker--inline">NOW PLAYING · 再生中</Sticker>
          {session.stream && <span className="y-stream-badge">在线串流 · 未下载</span>}
        </div>
        <div className="y-player-expanded__title">{session.workTitle}</div>
        <div className="y-player-expanded__meta">
          {session.rj && <span className="y-player-expanded__rj">{session.rj}</span>}
          {session.rj && " · "}
          {session.cv ? `CV ${session.cv} · ` : ""}共 {session.tracks.length} 曲目
        </div>
        <div className="y-player-expanded__tracks">
          {session.tracks.map((track, i) => {
            const on = i === index;
            return (
              <button
                type="button"
                key={track.id}
                className={cn("y-trackrow", on && "is-on")}
                onClick={() => playAt(i)}
              >
                <span className="y-trackrow__num">{on ? "♪" : i + 1}</span>
                <span className="y-trackrow__name">{track.title}</span>
                {on && <EQ playing={playing} className="y-trackrow__eq" />}
                <span className="y-trackrow__dur">
                  {track.duration ? formatTime(track.duration) : ""}
                </span>
              </button>
            );
          })}
        </div>
        {session.stream && (
          <div className="y-stream-dl">
            <span className="y-stream-dl__note">
              <span className="y-stream-dl__mark">♪</span>正在串流播放,喜欢的话可以收进媒体库。
            </span>
            <button
              type="button"
              className="y-btn-primary y-stream-dl__btn"
              disabled={queued || !sourceId}
              onClick={downloadThis}
            >
              {queued ? "已入队 ✓" : "↓ 下载本作"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** 虚线字幕卡:按 currentTime 高亮当前行并滚动到可视区(字幕数据来自 PlayerContext) */
function SubtitleCard({ track }: { track: PlayerTrack }) {
  const { subtitleCues: cues, subtitleState: state, activeCueIdx } = useGlobalPlayer();
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeCueIdx]);

  let body;
  if (!track.subtitleUrl) {
    body = <div className="y-subtitle__empty">この作品には字幕がありません</div>;
  } else if (state === "loading") {
    body = <div className="y-subtitle__empty">字幕加载中…</div>;
  } else if (state === "error") {
    body = <div className="y-subtitle__empty">字幕加载失败</div>;
  } else if (cues.length === 0) {
    body = <div className="y-subtitle__empty">この作品には字幕がありません</div>;
  } else {
    body = (
      <div className="y-subtitle__list" ref={listRef}>
        {cues.map((cue, i) => (
          <div
            key={`${cue.start}-${i}`}
            ref={i === activeCueIdx ? activeRef : undefined}
            className={cn("y-subtitle__line", i === activeCueIdx && "is-active")}
          >
            {cue.text}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="y-subtitle">
      <div className="y-subtitle__head">字幕 · SUBTITLE</div>
      {body}
    </div>
  );
}
