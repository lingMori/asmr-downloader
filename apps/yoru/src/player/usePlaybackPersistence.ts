import { useCallback, useEffect, useRef, type RefObject } from "react";
import { apiClient } from "@/lib/api";
import { shouldPersistPosition } from "./logic";
import type { PlaybackSession } from "./types";

const PROGRESS_SAVE_INTERVAL_MS = 10_000;
const PROGRESS_SAVE_THROTTLE_MS = 2_000;

export type PersistReason = "interval" | "pause" | "switch" | "close";

type PersistenceRefs = {
  sessionRef: RefObject<PlaybackSession | null>;
  indexRef: RefObject<number>;
  audioRef: RefObject<HTMLAudioElement | null>;
  playingRef: RefObject<boolean>;
};

/**
 * 播放进度持久化(移植自旧 AudioDeck.persistProgress):
 * playing 中每 10s 一次 + 2s 节流;pause/切曲/卸载各补一次;
 * sourceId 缺省或 position <= 5s 时跳过(本地/远端统一走 track_path=track.url)。
 */
export function usePlaybackPersistence({
  sessionRef,
  indexRef,
  audioRef,
  playingRef,
}: PersistenceRefs) {
  const lastSaveRef = useRef(0);

  const flush = useCallback(
    (reason: PersistReason) => {
      const session = sessionRef.current;
      const audio = audioRef.current;
      if (!session || !audio) {
        return;
      }
      const track = session.tracks[indexRef.current];
      const position = audio.currentTime || 0;
      if (!track || !shouldPersistPosition(session, position)) {
        return;
      }
      const now = Date.now();
      if (reason !== "close" && now - lastSaveRef.current < PROGRESS_SAVE_THROTTLE_MS) {
        return;
      }
      lastSaveRef.current = now;
      void apiClient
        .savePlaybackProgress({
          source_id: session.sourceId!,
          work_title: session.workTitle,
          cover_url: session.coverUrl ?? "",
          track_path: track.url,
          track_title: track.title,
          position,
          duration: Number.isFinite(audio.duration) ? audio.duration : 0,
          updated_at: new Date().toISOString(),
        })
        .catch((error) => {
          console.debug("[yoru player] progress save failed", { reason, error });
        });
    },
    [sessionRef, indexRef, audioRef],
  );

  // playing 中每 10s 定期上报
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (playingRef.current) {
        flush("interval");
      }
    }, PROGRESS_SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [flush, playingRef]);

  // Provider 卸载(应用关闭)时兜底一次
  useEffect(() => {
    return () => flush("close");
  }, [flush]);

  return flush;
}
