import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { keys } from "@/lib/keys";
import {
  findSubtitleForAudio,
  flattenPlayableTracks,
  flattenSubtitleTracks,
} from "@/lib/playback";
import { useGlobalPlayer } from "@/player";

export type StreamWorkMeta = {
  workTitle: string;
  coverUrl?: string;
  cv?: string;
  rj?: string;
};

/**
 * 「fetch 详情 → 拍平音轨 → 建串流会话」小助手(收藏卡/在线卡共用)。
 * 返回的 loadingId 为正在拉详情的 sourceId,供卡片显示加载罩;
 * 拉取期间的并发调用直接忽略(返回 false)。
 */
export function useStreamSession() {
  const queryClient = useQueryClient();
  const { playSession } = useGlobalPlayer();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const playWorkStream = useCallback(
    async (sourceId: string, meta: StreamWorkMeta): Promise<boolean> => {
      if (loadingId) return false;
      setLoadingId(sourceId);
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: keys.discover.work(sourceId),
          queryFn: () => apiClient.getDiscoverWork(sourceId),
          staleTime: 60_000,
        });
        const subtitles = flattenSubtitleTracks(detail.tracks);
        const tracks = flattenPlayableTracks(detail.tracks).map((audio) => ({
          id: audio.path,
          title: audio.name,
          url: audio.url,
          subtitleUrl: findSubtitleForAudio(subtitles, audio)?.url,
        }));
        if (tracks.length === 0) {
          toast.error("该作品暂无可播放的音轨");
          return false;
        }
        playSession({
          sourceId,
          workTitle: meta.workTitle,
          coverUrl: meta.coverUrl,
          tracks,
          startIndex: 0,
          stream: true,
          cv: meta.cv,
          rj: meta.rj ?? sourceId,
        });
        return true;
      } catch (err) {
        toast.error(`加载音轨失败:${err instanceof Error ? err.message : "未知错误"}`);
        return false;
      } finally {
        setLoadingId(null);
      }
    },
    [loadingId, queryClient, playSession],
  );

  return { playWorkStream, loadingId };
}
