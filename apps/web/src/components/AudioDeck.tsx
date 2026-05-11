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
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  Subtitles,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LibraryFile } from "@/lib/api";
import { cn } from "@/lib/utils";

const PLAYER_LOG_PREFIX = "[ASMRoner Player]";

export type AudioDeckHandle = {
  playTrack: (path?: string) => Promise<void>;
  pause: () => void;
};

export const AudioDeck = forwardRef<AudioDeckHandle, {
  tracks: LibraryFile[];
  selectedPath: string;
  onSelect: (path: string) => void;
  subtitle?: LibraryFile;
  title: string;
  mediaId: string;
  coverUrl?: string;
  onEnded?: () => void;
}>(function AudioDeck({
  tracks,
  selectedPath,
  onSelect,
  subtitle,
  title,
  mediaId,
  coverUrl,
  onEnded,
}, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const seekingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seekDraft, setSeekDraft] = useState(0);
  const [playError, setPlayError] = useState("");

  const selected = useMemo(
    () => tracks.find((track) => track.path === selectedPath),
    [selectedPath, tracks],
  );
  const selectedIndex = Math.max(0, tracks.findIndex((track) => track.path === selectedPath));
  const canSeek = Boolean(selected && Number.isFinite(duration) && duration > 0);
  const seekValue = canSeek ? clampTime(seeking ? seekDraft : time, duration) : 0;
  const seekPercent = canSeek ? (seekValue / duration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = volume;
  }, [volume]);

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
      setPlayError("STREAM ERR");
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
    drawWaveform();
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [playing, selected?.url]);

  useImperativeHandle(ref, () => ({
    playTrack,
    pause: () => audioRef.current?.pause(),
  }));

  function beginSeek() {
    if (!canSeek) {
      return;
    }
    seekingRef.current = true;
    setSeeking(true);
    setSeekDraft(clampTime(time, duration));
  }

  function finishSeek() {
    if (!seekingRef.current) {
      return;
    }
    seekingRef.current = false;
    setSeeking(false);
    setSeekDraft(0);
  }

  function seekTo(value: number) {
    if (!canSeek) {
      return;
    }
    const nextTime = clampTime(value, duration);
    setSeekDraft(nextTime);
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
    }
    setPlayError("");
    void probeTrackURL(target.url);
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
      setPlayError("PLAY BLOCKED");
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

  function drawWaveform() {
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
    ctx.fillStyle = "rgba(5, 8, 7, 0.24)";
    ctx.fillRect(0, 0, width, height);

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
      ctx.fillStyle = index % 5 === 0 ? "#ff3d7f" : "#7cffb2";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.fillRect(index * step + 2, height - barHeight - 4, Math.max(2, step - 4), barHeight);
    }
    rafRef.current = window.requestAnimationFrame(drawWaveform);
  }

  function selectRelative(offset: number) {
    if (tracks.length === 0) {
      return;
    }
    const next = (selectedIndex + offset + tracks.length) % tracks.length;
    void playTrack(tracks[next].path);
  }

  return (
    <div className="deck-chassis p-4" data-live={playing ? "true" : undefined}>
      {createElement(
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
        subtitle
          ? createElement("track", {
              kind: "captions",
              label: "Captions",
              srcLang: "zh",
              src: subtitle.url,
              default: true,
            })
          : null,
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={playError ? "halt" : playing ? "live" : "warn"}>
              {playError || (playing ? "REC" : "PAUSE")}
            </Badge>
            <Badge variant="decal">{mediaId}</Badge>
          </div>
          <h3 className="console-title mt-3 line-clamp-2 text-2xl font-black text-[color:var(--text-display)]">
            {selected?.name || title}
          </h3>
          <div className="console-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-mute)]">
            TRACK {String(selectedIndex + 1).padStart(2, "0")} / {String(tracks.length).padStart(2, "0")}
          </div>
        </div>
        {coverUrl ? (
          <div className="deck-screen h-20 w-20 shrink-0">
            <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-80" />
          </div>
        ) : null}
      </div>

      <div className="deck-screen mt-4 p-3">
        <canvas ref={canvasRef} width={640} height={128} className="h-28 w-full" />
      </div>

      <div
        className="deck-plate audio-seek mt-3 px-3 py-2"
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
          onPointerDown={beginSeek}
          onPointerUp={finishSeek}
          onPointerCancel={finishSeek}
          onBlur={finishSeek}
          onChange={(event) => seekTo(Number(event.currentTarget.value))}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="console-readout text-xs">{formatTime(seekValue)}</span>
          <span className="console-readout text-xs">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => selectRelative(-1)} disabled={tracks.length === 0}>
            <SkipBack className="h-4 w-4" weight="duotone" />
          </Button>
          <Button onClick={togglePlayback} disabled={!selected}>
            {playing ? <Pause className="h-4 w-4" weight="duotone" /> : <Play className="h-4 w-4" weight="duotone" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => selectRelative(1)} disabled={tracks.length === 0}>
            <SkipForward className="h-4 w-4" weight="duotone" />
          </Button>
          <Button variant={loop ? "primary" : "secondary"} size="sm" onClick={() => setLoop((value) => !value)}>
            Loop
          </Button>
        </div>

        <div className="deck-plate flex items-center gap-3 px-3 py-2">
          <SpeakerHigh className="h-4 w-4 text-[color:var(--telltale-amber)]" weight="duotone" />
          <div className="flex flex-1 gap-1">
            {Array.from({ length: 10 }).map((_, index) => {
              const active = index < Math.round(volume * 10);
              return (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "h-4 flex-1 border border-[color:var(--chassis-edge)]",
                    active ? "bg-[color:var(--phosphor-primary)] shadow-[var(--glow-phosphor)]" : "bg-[color:var(--screen-void)]",
                  )}
                  onClick={() => setVolume((index + 1) / 10)}
                  aria-label={`Volume ${index + 1}`}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={subtitle ? "signal" : "mute"}>
            <Subtitles className="mr-1 h-3 w-3" weight="duotone" />
            {subtitle ? "CC ON" : "CC OFF"}
          </Badge>
          <span className="console-readout text-sm">
            {formatTime(time)} / {formatTime(duration)}
          </span>
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

function clampTime(value: number, duration: number) {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(duration, Math.max(0, value));
}

function logPlayer(message: string, details?: unknown) {
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
