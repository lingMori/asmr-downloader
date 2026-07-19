import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AudioDeck, type AudioDeckHandle } from "@/components/AudioDeck";
import type { LibraryFile } from "@/lib/api";
import { findSubtitleForAudio } from "@/lib/playback";

export type PlaybackSession = {
  tracks: LibraryFile[];
  subtitles?: LibraryFile[];
  title: string;
  mediaId: string;
  coverUrl?: string;
  /**
   * RJ source id for remote (discover stream) sessions. Enables listening
   * feedback milestones, playback-progress persistence, and the stream
   * download shortcut in the expanded player.
   */
  sourceId?: string;
};

export type PlayOptions = {
  /** Resume position in seconds; applied after metadata loads. */
  startPosition?: number;
};

type PlayerContextValue = {
  activeMediaId?: string;
  selectedPath: string;
  play: (session: PlaybackSession, path?: string, opts?: PlayOptions) => void;
  load: (session: PlaybackSession, path?: string, opts?: PlayOptions) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function GlobalPlayerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [startPosition, setStartPosition] = useState(0);
  const [playRequest, setPlayRequest] = useState(0);
  const deckRef = useRef<AudioDeckHandle | null>(null);

  const setPlayback = (
    nextSession: PlaybackSession,
    path: string | undefined,
    autoplay: boolean,
    opts?: PlayOptions,
  ) => {
    const nextPath = path || nextSession.tracks[0]?.path || "";
    setSession(nextSession);
    setSelectedPath(nextPath);
    setStartPosition(Math.max(0, opts?.startPosition ?? 0));
    if (autoplay && nextPath) setPlayRequest((value) => value + 1);
  };

  useEffect(() => {
    if (playRequest === 0 || !selectedPath) return;
    void deckRef.current?.playTrack(selectedPath);
  }, [playRequest, selectedPath, session]);

  useEffect(() => {
    document.documentElement.dataset.playerActive = session ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.playerActive;
    };
  }, [session]);

  const selectedAudio = session?.tracks.find((track) => track.path === selectedPath);
  const selectedSubtitle = findSubtitleForAudio(session?.subtitles ?? [], selectedAudio);
  const contextValue = useMemo<PlayerContextValue>(() => ({
    activeMediaId: session?.mediaId,
    selectedPath,
    play: (nextSession, path, opts) => setPlayback(nextSession, path, true, opts),
    load: (nextSession, path, opts) => setPlayback(nextSession, path, false, opts),
  }), [selectedPath, session?.mediaId]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
      {session && session.tracks.length > 0 ? (
        <AudioDeck
          ref={deckRef}
          variant="dock"
          tracks={session.tracks}
          selectedPath={selectedPath}
          onSelect={setSelectedPath}
          subtitle={selectedSubtitle}
          subtitles={session.subtitles}
          title={session.title}
          mediaId={session.mediaId}
          coverUrl={session.coverUrl}
          sourceId={session.sourceId}
          startPosition={startPosition}
          onClose={() => {
            deckRef.current?.pause();
            setSession(null);
            setSelectedPath("");
            setStartPosition(0);
            setPlayRequest(0);
          }}
          onEnded={() => {
            const currentIndex = session.tracks.findIndex((track) => track.path === selectedPath);
            const next = session.tracks[currentIndex + 1];
            if (next) {
              setSelectedPath(next.path);
              setPlayRequest((value) => value + 1);
            }
          }}
        />
      ) : null}
    </PlayerContext.Provider>
  );
}

export function useGlobalPlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("useGlobalPlayer must be used inside GlobalPlayerProvider");
  return context;
}
