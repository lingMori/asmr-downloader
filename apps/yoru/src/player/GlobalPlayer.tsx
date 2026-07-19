import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { globalFeedbackTracker } from "@/lib/feedback";
import {
  clampIndex,
  findTrackIndexByUrl,
  nextIndex,
  prevIndex,
  shouldResume,
  shouldSendFeedback,
} from "./logic";
import { usePlaybackPersistence } from "./usePlaybackPersistence";
import type { PlaybackSession, PlayerTrack } from "./types";

export type PlaySessionOptions = {
  /** 显式指定续播秒数;指定后不再查服务端历史进度 */
  resumeFrom?: number;
};

export type PlayerContextValue = {
  session: PlaybackSession | null;
  index: number;
  playing: boolean;
  expanded: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  currentTrack: PlayerTrack | null;
  /** 后续页面唯一入口:建立一个新会话并开播 */
  playSession: (session: PlaybackSession, opts?: PlaySessionOptions) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  /** 曲目列表点选(钳制在会话范围内,无边界提示) */
  playAt: (index: number) => void;
  seekTo: (sec: number) => void;
  setExpanded: (open: boolean) => void;
  setVolume: (v: number) => void;
  toggleMuted: () => void;
  /** 停止并清空会话(播放条消失) */
  close: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function GlobalPlayerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  // 事件回调/节流里读最新值的镜像 ref
  const sessionRef = useRef<PlaybackSession | null>(null);
  const indexRef = useRef(0);
  const playingRef = useRef(false);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const flush = usePlaybackPersistence({ sessionRef, indexRef, audioRef, playingRef });

  const playSession = useCallback(
    (next: PlaybackSession, opts?: PlaySessionOptions) => {
      if (next.tracks.length === 0) {
        return;
      }
      flush("switch");
      globalFeedbackTracker.stop();
      const start = clampIndex(next.startIndex, next.tracks.length);
      sessionRef.current = next;
      indexRef.current = start;
      playingRef.current = true;
      setSession(next);
      setIndex(start);
      setPlaying(true);
      setPosition(0);
      setDuration(0);
      pendingSeekRef.current = opts?.resumeFrom ?? null;

      // 未显式指定 resumeFrom 时查服务端历史进度,404 视为无进度从头播
      if (opts?.resumeFrom == null && next.sourceId) {
        void apiClient
          .getPlaybackProgress(next.sourceId)
          .then((progress) => {
            if (sessionRef.current !== next || !shouldResume(progress.position)) {
              return;
            }
            const trackIdx = findTrackIndexByUrl(next.tracks, progress.track_path);
            if (trackIdx >= 0 && trackIdx !== indexRef.current) {
              indexRef.current = trackIdx;
              setIndex(trackIdx);
            }
            pendingSeekRef.current = progress.position;
          })
          .catch(() => {
            /* 404/网络错误 = 无历史进度 */
          });
      }
    },
    [flush],
  );

  const switchTrack = useCallback(
    (nextIdx: number) => {
      const current = sessionRef.current;
      if (!current) {
        return;
      }
      const clamped = clampIndex(nextIdx, current.tracks.length);
      if (clamped === indexRef.current) {
        return;
      }
      flush("switch");
      indexRef.current = clamped;
      setIndex(clamped);
      setPosition(0);
      setDuration(0);
      setPlaying(true);
      // 同作品换轨:feedback tracker 以 sourceId 为键,继续 tick 即可
    },
    [flush],
  );

  const next = useCallback(() => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    const result = nextIndex(indexRef.current, current.tracks.length);
    if (result.atBoundary) {
      toast.info("已经是最后一首");
      return;
    }
    switchTrack(result.index);
  }, [switchTrack]);

  const prev = useCallback(() => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    const result = prevIndex(indexRef.current, current.tracks.length);
    if (result.atBoundary) {
      toast.info("已经是第一首");
      return;
    }
    switchTrack(result.index);
  }, [switchTrack]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!sessionRef.current || !audio) {
      return;
    }
    if (audio.paused) {
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seekTo = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (!audio || !sessionRef.current) {
      return;
    }
    const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
    const clamped = dur > 0 ? Math.min(Math.max(0, sec), dur) : Math.max(0, sec);
    try {
      audio.currentTime = clamped;
    } catch {
      /* jsdom 等环境忽略 */
    }
    setPosition(clamped);
  }, []);

  const close = useCallback(() => {
    flush("close");
    globalFeedbackTracker.stop();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    sessionRef.current = null;
    indexRef.current = 0;
    playingRef.current = false;
    setSession(null);
    setIndex(0);
    setPlaying(false);
    setExpanded(false);
    setPosition(0);
    setDuration(0);
  }, [flush]);

  const applyPendingSeek = useCallback(() => {
    const target = pendingSeekRef.current;
    const audio = audioRef.current;
    if (target == null || !audio) {
      return;
    }
    const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (dur <= 0) {
      return;
    }
    const clamped = Math.min(Math.max(0, target), Math.max(0, dur - 3));
    try {
      audio.currentTime = clamped;
      setPosition(clamped);
    } catch {
      /* jsdom 等环境忽略 */
    }
    pendingSeekRef.current = null;
  }, []);

  // 常驻 <audio> 事件接线(挂载一次,经 ref 读最新会话)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const onTime = () => {
      const time = audio.currentTime || 0;
      setPosition(time);
      const current = sessionRef.current;
      if (shouldSendFeedback(current)) {
        globalFeedbackTracker.tick(
          current!.sourceId!,
          time,
          Number.isFinite(audio.duration) ? audio.duration : 0,
        );
      }
    };
    const onDuration = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      applyPendingSeek();
    };
    const onPlay = () => {
      setPlaying(true);
      const current = sessionRef.current;
      if (shouldSendFeedback(current)) {
        globalFeedbackTracker.start(current!.sourceId!);
      }
    };
    const onPause = () => {
      setPlaying(false);
      flush("pause");
    };
    const onEnded = () => {
      const current = sessionRef.current;
      if (!current) {
        return;
      }
      const result = nextIndex(indexRef.current, current.tracks.length);
      if (result.atBoundary) {
        setPlaying(false);
        return;
      }
      switchTrack(result.index);
    };
    const onError = () => {
      setPlaying(false);
      toast.error("播放失败,请检查网络或镜像");
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [applyPendingSeek, flush, switchTrack]);

  const currentTrack = session ? (session.tracks[index] ?? null) : null;
  const trackUrl = currentTrack?.url ?? "";

  // 换轨自动开播(playing 为 true 时)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackUrl) {
      return;
    }
    if (playingRef.current) {
      void audio.play().catch(() => {});
    }
  }, [trackUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      session,
      index,
      playing,
      expanded,
      position,
      duration,
      volume,
      muted,
      currentTrack,
      playSession,
      toggle,
      next,
      prev,
      playAt: switchTrack,
      seekTo,
      setExpanded,
      setVolume,
      toggleMuted: () => setMuted((m) => !m),
      close,
    }),
    [
      session,
      index,
      playing,
      expanded,
      position,
      duration,
      volume,
      muted,
      currentTrack,
      playSession,
      toggle,
      next,
      prev,
      switchTrack,
      seekTo,
      close,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* 常驻 audio:Provider 挂在路由根部,不随页面卸载 */}
      <audio ref={audioRef} src={trackUrl || undefined} preload="metadata" />
    </PlayerContext.Provider>
  );
}

export function useGlobalPlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("useGlobalPlayer must be used inside GlobalPlayerProvider");
  }
  return context;
}
