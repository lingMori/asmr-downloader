import { useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  CaretDown,
  CaretUp,
  MusicNote,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerSlash,
} from "@phosphor-icons/react";
import { CoverPlaceholder, EQ, type CoverColor } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatTime } from "./logic";
import { useGlobalPlayer } from "./GlobalPlayer";

const COVER_COLORS: CoverColor[] = ["lav", "rose", "blue", "plum"];

export function pickCoverColor(seed: string): CoverColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
}

/**
 * 迷你播放条(原型 dc.html:533-548):
 * 桌面 = 全量(封面/标题/‹‹ ▶ ››/seek 拖拽/EQ/展开/音量);
 * 移动(<768px)= 压缩单行 + 底部 2px 进度细条,点整行展开。
 */
export function PlayerBar() {
  const player = useGlobalPlayer();
  const { session, currentTrack } = player;
  if (!session || !currentTrack) {
    return null;
  }
  return (
    <>
      <DesktopBar />
      <CompactBar />
    </>
  );
}

/**
 * 停靠字幕行(原型缺失,按同范式补):不展开播放器也能看到
 * 随时间轴命中的当前句;点击展开查看完整字幕卡。
 */
function DockedCue() {
  const { subtitleCues, activeCueIdx, setExpanded } = useGlobalPlayer();
  if (activeCueIdx < 0) {
    return null;
  }
  const cue = subtitleCues[activeCueIdx];
  if (!cue?.text) {
    return null;
  }
  return (
    <button
      type="button"
      className="y-playerbar__cue"
      data-testid="playerbar-cue"
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(true);
      }}
      title="展开查看全部字幕"
      aria-label="展开查看全部字幕"
    >
      <span className="y-playerbar__cue-icon" aria-hidden="true">
        <MusicNote size={12} />
      </span>
      <span className="y-playerbar__cue-text">{cue.text}</span>
    </button>
  );
}

function DesktopBar() {
  const {
    session,
    index,
    playing,
    expanded,
    position,
    duration,
    volume,
    muted,
    currentTrack,
    toggle,
    next,
    prev,
    seekTo,
    setExpanded,
    setVolume,
    toggleMuted,
  } = useGlobalPlayer();
  if (!session || !currentTrack) {
    return null;
  }
  const playState = playing ? "いま再生中…" : "一時停止中";
  return (
    <footer className="y-playerbar y-playerbar--desktop" data-testid="playerbar-desktop">
      <DockedCue />
      {session.coverUrl ? (
        <motion.img
          className="y-playerbar__cover"
          src={session.coverUrl}
          alt=""
          /* 共享元素转场:展开时把 layoutId 让给展开层大封面 */
          layoutId={expanded ? undefined : "player-cover"}
          style={{ borderRadius: 8 }}
        />
      ) : (
        <CoverPlaceholder
          className="y-playerbar__cover"
          color={pickCoverColor(session.workTitle)}
          label=""
        />
      )}
      <div className="y-playerbar__meta">
        <div className="y-playerbar__title">
          {session.workTitle} · Track {index + 1}
        </div>
        <div className="y-playerbar__sub">
          {session.stream && <span className="y-stream-badge y-stream-badge--sm">在线</span>}
          <span className="y-playerbar__subtext">
            {session.cv ? `CV ${session.cv} · ` : ""}
            {playState}
          </span>
        </div>
      </div>
      <div className="y-playerbar__controls">
        <button type="button" className="y-playerbar__step" onClick={prev} aria-label="上一首">
          <SkipBack size={15} weight="fill" />
        </button>
        <button
          type="button"
          className="y-playerbar__play"
          onClick={toggle}
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? <Pause size={17} weight="fill" /> : <Play size={17} weight="fill" />}
        </button>
        <button type="button" className="y-playerbar__step" onClick={next} aria-label="下一首">
          <SkipForward size={15} weight="fill" />
        </button>
      </div>
      <div className="y-playerbar__seekwrap">
        <span className="y-playerbar__time">{formatTime(position)}</span>
        <SeekBar position={position} duration={duration} onSeek={seekTo} />
        <span className="y-playerbar__time">{formatTime(duration)}</span>
      </div>
      <EQ playing={playing} />
      <button
        type="button"
        className="y-playerbar__expand"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <>
            收起 <CaretDown size={12} weight="bold" />
          </>
        ) : (
          <>
            展开 <CaretUp size={12} weight="bold" />
          </>
        )}
      </button>
      <div className="y-playerbar__volume">
        <button
          type="button"
          className="y-playerbar__volbtn"
          onClick={toggleMuted}
          aria-label={muted ? "取消静音" : "静音"}
        >
          {muted || volume === 0 ? (
            <SpeakerSlash size={15} weight="fill" />
          ) : (
            <SpeakerHigh size={15} weight="fill" />
          )}
        </button>
        <input
          className="y-playerbar__volslider"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.currentTarget.value))}
          aria-label="音量"
        />
      </div>
    </footer>
  );
}

function CompactBar() {
  const {
    session,
    playing,
    position,
    duration,
    toggle,
    setExpanded,
  } = useGlobalPlayer();
  if (!session) {
    return null;
  }
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <footer
      className="y-playerbar y-playerbar--compact"
      data-testid="playerbar-compact"
      onClick={() => setExpanded(true)}
    >
      <DockedCue />
      {session.coverUrl ? (
        <img className="y-playerbar__cover" src={session.coverUrl} alt="" />
      ) : (
        <CoverPlaceholder
          className="y-playerbar__cover"
          color={pickCoverColor(session.workTitle)}
          label=""
        />
      )}
      <div className="y-playerbar__title y-playerbar__title--compact">{session.workTitle}</div>
      <button
        type="button"
        className="y-playerbar__play y-playerbar__play--sm"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={playing ? "暂停" : "播放"}
      >
        {playing ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" />}
      </button>
      <div className="y-playerbar__line" aria-hidden="true">
        <div className="y-playerbar__linefill" style={{ width: `${pct}%` }} />
      </div>
    </footer>
  );
}

/** 可拖拽 seek 条(y-progress--seek + pointer events);展开播放器移动端控件区复用 */
export function SeekBar({
  position,
  duration,
  onSeek,
}: {
  position: number;
  duration: number;
  onSeek: (sec: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? position;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (shown / duration) * 100)) : 0;

  const ratioAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return 0;
    }
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  return (
    <div
      ref={barRef}
      className={cn("y-progress", "y-progress--seek", "y-seekbar")}
      role="slider"
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shown)}
      tabIndex={0}
      style={{ "--progress-pct": `${pct}%` } as CSSProperties}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraft(ratioAt(e.clientX) * duration);
      }}
      onPointerMove={(e) => {
        if (draft !== null) {
          setDraft(ratioAt(e.clientX) * duration);
        }
      }}
      onPointerUp={(e) => {
        if (draft !== null) {
          onSeek(ratioAt(e.clientX) * duration);
          setDraft(null);
        }
      }}
      onPointerCancel={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          onSeek(position - 5);
        } else if (e.key === "ArrowRight") {
          onSeek(position + 5);
        }
      }}
    >
      <div className="y-progress__fill" style={{ width: `${pct}%` }} />
      <div className="y-progress__thumb" />
    </div>
  );
}
