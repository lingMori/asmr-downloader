import type { SubtitleCue } from "@/lib/subtitles";
import type { PlaybackSession, PlayerTrack } from "./types";

/** position 超过该值才值得续播/持久化(与旧 AudioDeck 一致) */
export const MIN_RESUME_POSITION_SECONDS = 5;

export function clampIndex(index: number, trackCount: number): number {
  if (trackCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, index), trackCount - 1);
}

export type StepResult = {
  index: number;
  /** true = 已顶到边界(首曲再 prev / 末曲再 next),调用方提示 toast */
  atBoundary: boolean;
};

export function prevIndex(index: number, trackCount: number): StepResult {
  const next = clampIndex(index, trackCount);
  if (next <= 0) {
    return { index: 0, atBoundary: true };
  }
  return { index: next - 1, atBoundary: false };
}

export function nextIndex(index: number, trackCount: number): StepResult {
  const current = clampIndex(index, trackCount);
  if (current >= trackCount - 1) {
    return { index: Math.max(0, trackCount - 1), atBoundary: true };
  }
  return { index: current + 1, atBoundary: false };
}

/** 进度记录里的 track_path 对应会话内第几轨;-1 = 不在会话中 */
export function findTrackIndexByUrl(tracks: PlayerTrack[], url: string): number {
  if (!url) {
    return -1;
  }
  return tracks.findIndex((track) => track.url === url);
}

/** 字幕当前行:最后一个 start <= time 且 time < end 的 cue;-1 = 无命中 */
export function activeCueIndex(cues: SubtitleCue[], time: number): number {
  for (let i = cues.length - 1; i >= 0; i -= 1) {
    const cue = cues[i];
    if (time >= cue.start && time < cue.end) {
      return i;
    }
  }
  return -1;
}

/** 远端会话(sourceId + stream)才上报收听 feedback;本地会话不上报 */
export function shouldSendFeedback(session: PlaybackSession | null): boolean {
  return Boolean(session?.stream && session.sourceId);
}

/** 持久化门槛:有 sourceId 且播放位置足够靠后 */
export function shouldPersistPosition(
  session: PlaybackSession | null,
  position: number,
): boolean {
  return (
    Boolean(session?.sourceId) &&
    Number.isFinite(position) &&
    position > MIN_RESUME_POSITION_SECONDS
  );
}

/** 历史进度是否值得续播 */
export function shouldResume(position: number): boolean {
  return Number.isFinite(position) && position > MIN_RESUME_POSITION_SECONDS;
}

/** m:ss / h:mm:ss(非法输入给 "--:--") */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  }
  return `${m}:${ss}`;
}
