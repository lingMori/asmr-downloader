export type PlayerTrack = {
  /** 会话内唯一 id(本地=文件 path,远端=track id) */
  id: string;
  title: string;
  /** 可直接喂给 <audio> 的播放地址(/media/... 或 .../stream) */
  url: string;
  /** 秒;未知时由 audio.duration 补上 */
  duration?: number;
  /** 字幕文件地址(lrc/srt/vtt/ass),无则字幕卡显示空态 */
  subtitleUrl?: string;
};

export type PlaybackSession = {
  /** 进度持久化/feedback 的键(远端 RJ 或本地 library id);缺省时跳过持久化 */
  sourceId?: string;
  workTitle: string;
  coverUrl?: string;
  tracks: PlayerTrack[];
  startIndex: number;
  /** true = 在线串流(未下载):显示串流徽章 + 「↓ 下载本作」,并开启 feedback 上报 */
  stream: boolean;
  cv?: string;
  rj?: string;
};
