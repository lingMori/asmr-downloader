import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CaretDown,
  CaretUp,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  Subtitles,
  X,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LibraryFile } from "@/lib/api";
import { decodeSubtitleBuffer, parseSubtitleText } from "@/lib/subtitles";
import { cn } from "@/lib/utils";

const PLAYER_LOG_PREFIX = "[ASMRoner Player]";

type WaveformPalette = {
  accent: string;
  info: string;
};

export type AudioDeckHandle = {
  playTrack: (path?: string) => Promise<void>;
  pause: () => void;
};

export const AudioDeck = forwardRef<AudioDeckHandle, {
  tracks: LibraryFile[];
  selectedPath: string;
  onSelect: (path: string) => void;
  subtitle?: LibraryFile;
  subtitles?: LibraryFile[];
  variant?: "panel" | "dock";
  title: string;
  mediaId: string;
  coverUrl?: string;
  onEnded?: () => void;
  onClose?: () => void;
}>(function AudioDeck({
  tracks,
  selectedPath,
  onSelect,
  subtitle,
  subtitles = [],
  variant = "panel",
  title,
  mediaId,
  coverUrl,
  onEnded,
  onClose,
}, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const seekingRef = useRef(false);
  const seekDraftRef = useRef(0);
  const resumeAfterSeekRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seekDraft, setSeekDraft] = useState(0);
  const [playError, setPlayError] = useState("");
  const [dockExpanded, setDockExpanded] = useState(false);
  const [subtitlesVisible, setSubtitlesVisible] = useState(true);
  const [subtitleText, setSubtitleText] = useState("");
  const [loadedSubtitleUrl, setLoadedSubtitleUrl] = useState("");
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [subtitleError, setSubtitleError] = useState("");
  const [reduceMotion, setReduceMotion] = useState(getReducedMotionPreference);
  const [themeName, setThemeName] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.dataset.theme ?? "" : "",
  );

  const selected = useMemo(
    () => tracks.find((track) => track.path === selectedPath),
    [selectedPath, tracks],
  );
  const selectedIndex = Math.max(0, tracks.findIndex((track) => track.path === selectedPath));
  const canSeek = Boolean(selected && Number.isFinite(duration) && duration > 0);
  const seekValue = canSeek ? clampTime(seeking ? seekDraft : time, duration) : 0;
  const seekPercent = canSeek ? (seekValue / duration) * 100 : 0;
  const nativeSubtitle = subtitle && isNativeSubtitleFile(subtitle) ? subtitle : undefined;
  const subtitleCues = useMemo(
    () => loadedSubtitleUrl === subtitle?.url
      ? parseSubtitleText(subtitleText, subtitle?.name ?? "")
      : [],
    [loadedSubtitleUrl, subtitleText, subtitle?.name, subtitle?.url],
  );
  const activeSubtitle = useMemo(
    () => subtitleCues.find((cue) => time >= cue.start && time < cue.end),
    [subtitleCues, time],
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setThemeName(root.dataset.theme ?? "");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    const loadedSource = audio?.getAttribute("src");
    if (!audio || !loadedSource || loadedSource === selected?.url) {
      return;
    }

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    setPlaying(false);
    setPlayError("");
    setTime(0);
    setDuration(0);
    setSeekDraft(0);
    setSeeking(false);
    seekingRef.current = false;
    seekDraftRef.current = 0;
    resumeAfterSeekRef.current = false;
  }, [selected?.url]);

  useEffect(() => {
    if (!subtitle?.url) {
      setSubtitleText("");
      setLoadedSubtitleUrl("");
      setSubtitleError("");
      setSubtitleLoading(false);
      return;
    }

    const controller = new AbortController();
    setSubtitleText("");
    setLoadedSubtitleUrl("");
    setSubtitleLoading(true);
    setSubtitleError("");
    fetch(subtitle.url, { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.arrayBuffer().then((buffer) =>
          decodeSubtitleBuffer(buffer, response.headers.get("Content-Type") || ""),
        );
      })
      .then((text) => {
        setSubtitleText(text);
        setLoadedSubtitleUrl(subtitle.url);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        console.warn(PLAYER_LOG_PREFIX, "subtitle load failed", {
          error,
          subtitle,
        });
        setSubtitleText("");
        setLoadedSubtitleUrl(subtitle.url);
        setSubtitleError("字幕加载失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSubtitleLoading(false);
        }
      });

    return () => controller.abort();
  }, [subtitle?.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleTime = () => {
      if (!seekingRef.current) {
        setTime(audio.currentTime || 0);
      }
    };
    const handleDuration = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      logPlayer("audio metadata/duration updated", buildAudioDebugPayload(audio));
    };
    const handlePlay = () => {
      setPlaying(true);
      logPlayer("audio play event", buildAudioDebugPayload(audio));
    };
    const handlePause = () => {
      setPlaying(false);
      logPlayer("audio pause event", buildAudioDebugPayload(audio));
    };
    const handleLoadStart = () => {
      logPlayer("audio loadstart", buildAudioDebugPayload(audio));
    };
    const handleCanPlay = () => {
      logPlayer("audio canplay", buildAudioDebugPayload(audio));
    };
    const handlePlaying = () => {
      setPlaying(true);
      logPlayer("audio playing", buildAudioDebugPayload(audio));
    };
    const handleWaiting = () => {
      logPlayer("audio waiting", buildAudioDebugPayload(audio));
    };
    const handleStalled = () => {
      logPlayer("audio stalled", buildAudioDebugPayload(audio));
    };
    const handleError = () => {
      setPlaying(false);
      setPlayError("播放失败");
      console.error(
        PLAYER_LOG_PREFIX,
        "audio error event",
        buildAudioDebugPayload(audio),
      );
    };

    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("durationchange", handleDuration);
    audio.addEventListener("loadedmetadata", handleDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("stalled", handleStalled);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("durationchange", handleDuration);
      audio.removeEventListener("loadedmetadata", handleDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("stalled", handleStalled);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    const rootStyles = window.getComputedStyle(document.documentElement);
    const palette: WaveformPalette = {
      accent: rootStyles.getPropertyValue("--accent").trim() || "#9f3566",
      info: rootStyles.getPropertyValue("--info").trim() || "#24758a",
    };
    drawWaveform(palette);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [playing, reduceMotion, selected?.url, themeName]);

  useEffect(() => () => {
    window.cancelAnimationFrame(rafRef.current);
    try {
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
    } catch {
      // The browser may already have disconnected the graph during media teardown.
    }
    const context = contextRef.current;
    if (context && context.state !== "closed") {
      void context.close();
    }
    sourceRef.current = null;
    analyserRef.current = null;
    contextRef.current = null;
    dataRef.current = null;
  }, []);

  useImperativeHandle(ref, () => ({
    playTrack,
    pause: () => audioRef.current?.pause(),
  }));

  function beginSeek() {
    if (!canSeek) {
      return false;
    }
    const audio = audioRef.current;
    const nextTime = clampTime(time, duration);
    seekingRef.current = true;
    seekDraftRef.current = nextTime;
    resumeAfterSeekRef.current = Boolean(audio && !audio.paused);
    if (resumeAfterSeekRef.current) {
      audio?.pause();
    }
    setSeeking(true);
    setSeekDraft(nextTime);
    return true;
  }

  function finishSeek() {
    if (!seekingRef.current) {
      return;
    }
    const nextTime = seekDraftRef.current;
    const shouldResume = resumeAfterSeekRef.current;
    seekingRef.current = false;
    resumeAfterSeekRef.current = false;
    setSeeking(false);
    commitSeek(nextTime);

    const audio = audioRef.current;
    if (shouldResume && audio) {
      void audio.play()
        .then(() => {
          void ensureAnalyser();
        })
        .catch((error) => {
          setPlaying(false);
          setPlayError("PLAY BLOCKED");
          console.warn(PLAYER_LOG_PREFIX, "playback resume after seek failed", {
            error,
            audio: buildAudioDebugPayload(audio),
            nextTime,
          });
        });
    }
  }

  function previewSeek(value: number) {
    if (!canSeek) {
      return;
    }
    const nextTime = clampTime(value, duration);
    if (!seekingRef.current) {
      commitSeek(nextTime);
      return;
    }
    seekDraftRef.current = nextTime;
    setSeekDraft(nextTime);
  }

  function commitSeek(value: number) {
    if (!canSeek) {
      return;
    }
    const nextTime = clampTime(value, duration);
    setTime(nextTime);

    const audio = audioRef.current;
    if (audio) {
      try {
        audio.currentTime = nextTime;
      } catch (error) {
        console.warn(PLAYER_LOG_PREFIX, "seek failed", {
          error,
          audio: buildAudioDebugPayload(audio),
          nextTime,
        });
      }
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !selected) {
      return;
    }
    if (audio.paused) {
      await playTrack();
    } else {
      audio.pause();
    }
  }

  async function playTrack(path?: string) {
    const target = path
      ? tracks.find((track) => track.path === path)
      : selected;
    const audio = audioRef.current;
    if (!audio || !target) {
      console.warn(PLAYER_LOG_PREFIX, "playTrack ignored: missing audio element or target", {
        requestedPath: path,
        hasAudio: Boolean(audio),
        selectedPath,
        trackCount: tracks.length,
      });
      return;
    }
    const shouldSelect = target.path !== selectedPath;
    logPlayer("playTrack invoked", {
      requestedPath: path,
      selectedPath,
      targetPath: target.path,
      targetName: target.name,
      targetUrl: target.url,
      shouldSelect,
      trackCount: tracks.length,
      audio: buildAudioDebugPayload(audio),
    });
    if (audio.currentSrc !== target.url && audio.getAttribute("src") !== target.url) {
      logPlayer("setting audio src", {
        from: audio.getAttribute("src"),
        to: target.url,
        targetPath: target.path,
      });
      audio.src = target.url;
      audio.load();
      setTime(0);
      setDuration(0);
      setSeekDraft(0);
      setSeeking(false);
      seekingRef.current = false;
      seekDraftRef.current = 0;
      resumeAfterSeekRef.current = false;
    }
    setPlayError("");
    if (import.meta.env.DEV) {
      void probeTrackURL(target.url);
    }
    try {
      logPlayer("calling audio.play()", buildAudioDebugPayload(audio));
      await audio.play();
      logPlayer("audio.play() resolved", buildAudioDebugPayload(audio));
      void ensureAnalyser();
      if (shouldSelect) {
        onSelect(target.path);
      }
    } catch (error) {
      setPlaying(false);
      setPlayError("播放被浏览器阻止");
      if (shouldSelect) {
        onSelect(target.path);
      }
      console.warn(PLAYER_LOG_PREFIX, "audio.play() rejected", {
        error,
        audio: buildAudioDebugPayload(audio),
        targetPath: target.path,
        targetUrl: target.url,
      });
    }
  }

  async function ensureAnalyser() {
    if (analyserRef.current) {
      if (contextRef.current?.state === "suspended") {
        logPlayer("resuming existing AudioContext", {
          state: contextRef.current.state,
        });
        await contextRef.current.resume();
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      console.warn(PLAYER_LOG_PREFIX, "ensureAnalyser ignored: missing audio element");
      return;
    }
    logPlayer("creating analyser", buildAudioDebugPayload(audio));
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 128;
    sourceRef.current = context.createMediaElementSource(audio);
    sourceRef.current.connect(analyser);
    analyser.connect(context.destination);
    analyserRef.current = analyser;
    contextRef.current = context;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    if (context.state === "suspended") {
      logPlayer("resuming new AudioContext", { state: context.state });
      await context.resume();
    }
  }

  function drawWaveform(palette: WaveformPalette) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const analyser = analyserRef.current;
    const data = dataRef.current;
    if (analyser && data && playing) {
      analyser.getByteFrequencyData(data);
    }

    const bars = data ?? new Uint8Array(48).map((_, index) => 20 + ((index * 19) % 80));
    const step = width / bars.length;
    for (let index = 0; index < bars.length; index += 1) {
      const raw = playing ? bars[index] : Math.max(18, bars[index] * 0.35);
      const barHeight = Math.max(4, (raw / 255) * (height - 12));
      ctx.fillStyle = index % 5 === 0 ? palette.accent : palette.info;
      ctx.shadowBlur = 0;
      ctx.fillRect(index * step + 2, height - barHeight - 4, Math.max(2, step - 4), barHeight);
    }
    if (playing && !reduceMotion) {
      rafRef.current = window.requestAnimationFrame(() => drawWaveform(palette));
    }
  }

  function selectRelative(offset: number) {
    if (tracks.length === 0) {
      return;
    }
    const next = (selectedIndex + offset + tracks.length) % tracks.length;
    void playTrack(tracks[next].path);
  }

  function renderSeekControl(compact = false) {
    return (
      <div
        className={cn(
          "deck-plate audio-seek px-3 py-2",
          compact ? "audio-seek-compact" : "mt-3",
        )}
        style={{ "--seek-progress": `${seekPercent}%` } as CSSProperties}
      >
        <input
          type="range"
          min="0"
          max={canSeek ? duration : 0}
          step="0.1"
          value={seekValue}
          disabled={!canSeek}
          aria-label="播放进度"
          onPointerDown={(event) => {
            if (beginSeek()) {
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }
          }}
          onPointerUp={finishSeek}
          onPointerCancel={finishSeek}
          onBlur={finishSeek}
          onChange={(event) => previewSeek(Number(event.currentTarget.value))}
        />
        {!compact ? (
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="console-readout text-xs">{formatTime(seekValue)}</span>
            <span className="console-readout text-xs">{formatTime(duration)}</span>
          </div>
        ) : null}
      </div>
    );
  }

  function renderSubtitlePanel() {
    if (!subtitle) {
      return (
        <div className="deck-screen p-4 text-sm text-[color:var(--text-mute)]">
          当前音轨没有匹配的字幕文件。
        </div>
      );
    }

    return (
      <div className="deck-screen p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="signal">
            <Subtitles className="mr-1 h-3 w-3" weight="duotone" />
            {subtitle.name}
          </Badge>
          <span className="console-readout text-xs">{formatTime(time)}</span>
        </div>
        <div className="mt-4 min-h-[4.5rem] text-base font-semibold leading-7 text-[color:var(--text-display)]">
          {subtitleLoading ? "字幕加载中..." : null}
          {subtitleError ? subtitleError : null}
          {!subtitleLoading && !subtitleError ? (
            activeSubtitle?.text ||
            (subtitleCues.length > 0
              ? "当前时间没有字幕。"
              : "无法识别字幕时间轴。")
          ) : null}
        </div>
      </div>
    );
  }

  function renderPlaylistPanel() {
    return (
      <div className="space-y-3">
        <div className="text-xs font-semibold text-[color:var(--text-mute)]">播放列表</div>
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {tracks.map((track, index) => (
            <button
              key={track.path}
              type="button"
              className={cn(
                "deck-plate flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition",
                selectedPath === track.path
                  ? "border-[color:var(--tape-pink)] text-[color:var(--text-display)] shadow-[var(--glow-tape)]"
                  : "text-[color:var(--text-body)] hover:border-[color:var(--telltale-amber)]",
              )}
              onClick={() => void playTrack(track.path)}
            >
              <Badge variant={selectedPath === track.path ? "live" : "mute"}>
                {String(index + 1).padStart(2, "0")}
              </Badge>
              <span className="min-w-0 flex-1 truncate">{track.name}</span>
            </button>
          ))}
        </div>
        <div className="text-xs font-semibold text-[color:var(--text-mute)]">字幕文件 {subtitles.length}</div>
        {subtitlesVisible ? renderSubtitlePanel() : null}
      </div>
    );
  }

  const audioElement = createElement(
    "audio",
    {
      ref: audioRef,
      "data-media-id": mediaId,
      "data-selected-path": selectedPath,
      crossOrigin: "anonymous",
      preload: "metadata",
      loop,
      onEnded,
    },
    nativeSubtitle
      ? createElement("track", {
          kind: "captions",
          label: "Captions",
          srcLang: "zh",
          src: nativeSubtitle.url,
          default: true,
        })
      : null,
  );

  const deckBody = (
    <div className="deck-chassis p-4" data-live={playing ? "true" : undefined}>
      {audioElement}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={playError ? "halt" : playing ? "live" : "warn"}>
              {playError || (playing ? "播放中" : "已暂停")}
            </Badge>
            <Badge variant="decal">{mediaId}</Badge>
          </div>
          <h3 className="console-title mt-3 line-clamp-2 text-2xl font-black text-[color:var(--text-display)]">
            {selected?.name || title}
          </h3>
          <div className="console-mono mt-1 text-[10px] text-[color:var(--text-mute)]">
            音轨 {String(selectedIndex + 1).padStart(2, "0")} / {String(tracks.length).padStart(2, "0")}
          </div>
        </div>
        {coverUrl ? (
          <div className="audio-panel-cover h-20 w-20 shrink-0">
            <img src={coverUrl} alt={`${title} 封面`} className="h-full w-full object-cover" />
          </div>
        ) : null}
      </div>

      <div className="deck-screen mt-4 p-3">
        <canvas ref={canvasRef} width={640} height={128} className="h-28 w-full" role="img" aria-label="音频频谱" />
      </div>

      {renderSeekControl()}

      <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => selectRelative(-1)} disabled={tracks.length === 0} aria-label="上一音轨" title="上一音轨">
            <SkipBack className="h-4 w-4" weight="duotone" />
          </Button>
          <Button onClick={togglePlayback} disabled={!selected}>
            {playing ? <Pause className="h-4 w-4" weight="duotone" /> : <Play className="h-4 w-4" weight="duotone" />}
            {playing ? "暂停" : "播放"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => selectRelative(1)} disabled={tracks.length === 0} aria-label="下一音轨" title="下一音轨">
            <SkipForward className="h-4 w-4" weight="duotone" />
          </Button>
          <Button variant={loop ? "primary" : "secondary"} size="sm" onClick={() => setLoop((value) => !value)} aria-pressed={loop}>
            循环
          </Button>
          <Button
            variant={subtitle && subtitlesVisible ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSubtitlesVisible((value) => !value)}
            disabled={!subtitle}
            aria-label={subtitlesVisible ? "隐藏字幕" : "显示字幕"}
            aria-pressed={Boolean(subtitle && subtitlesVisible)}
            title={subtitlesVisible ? "隐藏字幕" : "显示字幕"}
          >
            <Subtitles className="h-4 w-4" weight={subtitle && subtitlesVisible ? "fill" : "regular"} />
          </Button>
        </div>

        <label className="deck-plate audio-volume flex items-center gap-3 px-3 py-2">
          <SpeakerHigh className="h-4 w-4 text-[color:var(--telltale-amber)]" weight="duotone" />
          <span className="sr-only">音量</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            aria-label="音量"
            onChange={(event) => setVolume(Number(event.currentTarget.value))}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={subtitle ? "signal" : "mute"}>
            <Subtitles className="mr-1 h-3 w-3" weight="duotone" />
            {subtitle ? (subtitlesVisible ? "字幕开启" : "字幕隐藏") : "无字幕"}
          </Badge>
          <span className="console-readout text-sm">
            {formatTime(time)} / {formatTime(duration)}
          </span>
        </div>
      </div>
      {variant === "panel" && subtitlesVisible ? <div className="mt-4">{renderSubtitlePanel()}</div> : null}
    </div>
  );

  if (variant !== "dock") {
    return deckBody;
  }

  return (
    <div className="audio-dock-shell" data-expanded={dockExpanded ? "true" : "false"}>
      {subtitlesVisible && activeSubtitle ? (
        <div className="yoru-floating-subtitle" aria-live="polite" aria-atomic="true">
          <div className="yoru-floating-subtitle-text">{activeSubtitle.text}</div>
        </div>
      ) : null}
      <div className="deck-chassis audio-dock-bar p-3" data-live={playing ? "true" : undefined}>
        {coverUrl ? (
          <div className="audio-panel-cover h-14 w-14 shrink-0">
            <img src={coverUrl} alt={`${title} 封面`} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={playError ? "halt" : playing ? "live" : "warn"}>
              {playError || (playing ? "播放中" : "已暂停")}
            </Badge>
            <Badge variant={subtitle ? "signal" : "mute"}>{subtitle ? "字幕" : "无字幕"}</Badge>
          </div>
          <div className="mt-1 truncate text-sm font-bold text-[color:var(--text-display)]">
            {selected?.name || title}
          </div>
        </div>
        <div className="audio-dock-timeline hidden min-w-[14rem] flex-1 md:block">{renderSeekControl(true)}</div>
        <div className="audio-dock-controls">
          <Button variant="secondary" size="sm" onClick={() => selectRelative(-1)} disabled={tracks.length === 0} aria-label="上一音轨" title="上一音轨">
            <SkipBack className="h-4 w-4" weight="duotone" />
          </Button>
          <Button size="sm" onClick={togglePlayback} disabled={!selected} aria-label={playing ? "暂停" : "播放"} title={playing ? "暂停" : "播放"}>
            {playing ? <Pause className="h-4 w-4" weight="duotone" /> : <Play className="h-4 w-4" weight="duotone" />}
          </Button>
          <Button
            variant={subtitle && subtitlesVisible ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSubtitlesVisible((value) => !value)}
            disabled={!subtitle}
            aria-label={subtitlesVisible ? "隐藏字幕" : "显示字幕"}
            aria-pressed={Boolean(subtitle && subtitlesVisible)}
            title={subtitlesVisible ? "隐藏字幕" : "显示字幕"}
          >
            <Subtitles className="h-4 w-4" weight={subtitle && subtitlesVisible ? "fill" : "regular"} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => selectRelative(1)} disabled={tracks.length === 0} aria-label="下一音轨" title="下一音轨">
            <SkipForward className="h-4 w-4" weight="duotone" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDockExpanded((value) => !value)}
            aria-expanded={dockExpanded}
            aria-label={dockExpanded ? "收起播放器" : "展开播放器"}
            title={dockExpanded ? "收起播放器" : "展开播放器"}
          >
            {dockExpanded ? (
              <CaretDown className="h-4 w-4" weight="bold" />
            ) : (
              <CaretUp className="h-4 w-4" weight="bold" />
            )}
          </Button>
          {onClose ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="关闭播放器"
              title="关闭播放器"
            >
              <X className="h-4 w-4" weight="bold" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn("audio-dock-panel", !dockExpanded && "audio-dock-panel-collapsed")}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          {deckBody}
          <div className="deck-chassis p-4">{renderPlaylistPanel()}</div>
        </div>
      </div>
    </div>
  );
});

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function formatTime(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getReducedMotionPreference() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clampTime(value: number, duration: number) {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(duration, Math.max(0, value));
}

function isNativeSubtitleFile(file: LibraryFile) {
  return /\.vtt($|\?)/i.test(file.name) || /\.vtt($|\?)/i.test(file.url);
}

function logPlayer(message: string, details?: unknown) {
  if (!import.meta.env.DEV) {
    return;
  }
  console.info(PLAYER_LOG_PREFIX, message, details ?? "");
}

function buildAudioDebugPayload(audio: HTMLAudioElement) {
  return {
    mediaId: mediaIdFromElement(audio),
    selectedPath: selectedPathFromElement(audio),
    srcAttr: audio.getAttribute("src"),
    currentSrc: audio.currentSrc,
    paused: audio.paused,
    readyState: audio.readyState,
    networkState: audio.networkState,
    currentTime: audio.currentTime,
    duration: Number.isFinite(audio.duration) ? audio.duration : null,
    error: audio.error
      ? {
          code: audio.error.code,
          message: audio.error.message,
        }
      : null,
  };
}

async function probeTrackURL(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Range: "bytes=0-0",
      },
    });
    const contentType = response.headers.get("Content-Type");
    const contentRange = response.headers.get("Content-Range");
    const acceptRanges = response.headers.get("Accept-Ranges");
    let bodyPreview = "";
    if (!response.ok || !contentType?.toLowerCase().startsWith("audio")) {
      bodyPreview = await response.clone().text().catch(() => "");
      bodyPreview = bodyPreview.slice(0, 500);
    }
    logPlayer("stream probe response", {
      url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType,
      contentRange,
      acceptRanges,
      bodyPreview,
    });
  } catch (error) {
    console.warn(PLAYER_LOG_PREFIX, "stream probe failed", { url, error });
  }
}

function mediaIdFromElement(audio: HTMLAudioElement) {
  return audio.dataset.mediaId || "";
}

function selectedPathFromElement(audio: HTMLAudioElement) {
  return audio.dataset.selectedPath || "";
}
