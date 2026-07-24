import type { LibraryFile, TrackNode } from "@/lib/api";
import { isSubtitleTrack, isTrackFolder } from "@/lib/playback";

/* ─────────────────────────────────────────────────────────────
   作品详情文件层级树(纯逻辑):
   本地 LibraryFile.path("SE13/01 xxx.mp3")/ 远端 TrackNode 树
   → 统一的 FileTreeNode 树,供 FileTree.tsx 递归渲染。
   ───────────────────────────────────────────────────────────── */

export type FileTreeKind = "folder" | "audio" | "subtitle" | "image" | "text" | "video" | "other";

export type FileTreeNode = {
  id: string;
  name: string;
  kind: FileTreeKind;
  children?: FileTreeNode[];
  /** 字节(宽松读取;未知时缺省) */
  size?: number;
  /** 秒(宽松读取;未知时缺省) */
  duration?: number;
  /** 可直接使用的地址:audio=播放地址,image/subtitle=文件地址 */
  url?: string;
  /** audio 叶:点击播放整作会话(闭包携带 startIndex,由 attachPlayHandlers 装配) */
  onPlay?: () => void;
};

function looseNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

const VIDEO_EXTS = [".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v"];
const TEXT_EXTS = [".txt", ".md", ".log", ".cue", ".json", ".nfo"];

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** 后端只给 audio/subtitle/image,其余按扩展名再细分(可预览性) */
export function classifyOther(name: string): FileTreeKind {
  const ext = extOf(name);
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (TEXT_EXTS.includes(ext)) return "text";
  return "other";
}

/** 本地文件列表 → 目录树(按 path 分段建文件夹,保持后端顺序) */
export function buildLocalFileTree(files: LibraryFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const folders = new Map<string, FileTreeNode>();

  for (const file of files) {
    const parts = (file.path || file.name)
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);
    const leafName = file.name || parts[parts.length - 1] || file.path;

    let siblings = root;
    let prefix = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
      let folder = folders.get(prefix);
      if (!folder) {
        folder = { id: `dir:${prefix}`, name: parts[i], kind: "folder", children: [] };
        folders.set(prefix, folder);
        siblings.push(folder);
      }
      siblings = folder.children!;
    }

    siblings.push({
      id: file.path,
      name: leafName,
      kind:
        file.kind === "audio"
          ? "audio"
          : file.kind === "subtitle"
            ? "subtitle"
            : file.kind === "image"
              ? "image"
              : classifyOther(leafName),
      url: file.url,
      size: looseNumber((file as LibraryFile & { size?: unknown }).size),
    });
  }

  return root;
}

/** 远端 TrackNode 树 → 统一节点树(folder/audio/subtitle/text/image/other) */
export function buildRemoteTrackTree(tracks: TrackNode[]): FileTreeNode[] {
  const toNode = (track: TrackNode, fallbackId: string): FileTreeNode => {
    const id = track.id || fallbackId;
    if (isTrackFolder(track)) {
      return {
        id: `dir:${id}`,
        name: track.title,
        kind: "folder",
        children: (track.children ?? []).map((child, index) => toNode(child, `${id}.${index}`)),
      };
    }
    const size = looseNumber((track as TrackNode & { size?: unknown }).size);
    const duration = looseNumber((track as TrackNode & { duration?: unknown }).duration);
    if (track.play_url) {
      return { id, name: track.title, kind: "audio", url: track.play_url, size, duration };
    }
    if (isSubtitleTrack(track)) {
      return { id, name: track.title, kind: "subtitle", url: track.file_url, size };
    }
    const type = track.type.toLowerCase();
    if (type.includes("text")) {
      return { id, name: track.title, kind: "text", url: track.file_url, size };
    }
    if (type.includes("image")) {
      return {
        id,
        name: track.title,
        kind: "image",
        url: track.file_url || track.media_stream_url || track.media_download_url,
        size,
      };
    }
    if (type.includes("video")) {
      return { id, name: track.title, kind: "video", url: track.file_url, size };
    }
    // 其余类型按扩展名再分类;file_url 一律带上(other 可外链打开/下载)
    return { id, name: track.title, kind: classifyOther(track.title), url: track.file_url, size };
  };

  return tracks.map((track, index) => toNode(track, String(index)));
}

/** DFS 拍平叶节点(folder 不返回;kind 过滤),顺序 = 树内出现顺序 */
export function flattenLeaves(nodes: FileTreeNode[], kind?: FileTreeKind): FileTreeNode[] {
  const out: FileTreeNode[] = [];
  const visit = (node: FileTreeNode) => {
    if (node.kind === "folder") {
      node.children?.forEach(visit);
      return;
    }
    if (!kind || node.kind === kind) out.push(node);
  };
  nodes.forEach(visit);
  return out;
}

/**
 * 给全部 audio 叶挂 onPlay:DFS 序与 flattenLeaves(nodes,"audio") 一致,
 * 因此会话 tracks 按同一顺序构建时,startIndex 与点击叶一一对应。
 */
export function attachPlayHandlers(
  nodes: FileTreeNode[],
  play: (startIndex: number) => void,
): FileTreeNode[] {
  let index = 0;
  const visit = (node: FileTreeNode): FileTreeNode => {
    if (node.kind === "folder") {
      return { ...node, children: (node.children ?? []).map(visit) };
    }
    if (node.kind === "audio") {
      const startIndex = index;
      index += 1;
      return { ...node, onPlay: () => play(startIndex) };
    }
    return node;
  };
  return nodes.map(visit);
}

/** 字节 → 人类可读(行右侧「大小」列) */
export function formatSize(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
