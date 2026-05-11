import type { LibraryFile, TrackNode } from "@/lib/api";

export function flattenPlayableTracks(nodes: TrackNode[]): LibraryFile[] {
  const files: LibraryFile[] = [];

  function visit(node: TrackNode, ancestors: string[]) {
    const nameParts = [...ancestors, node.title].filter(Boolean);
    if (node.id && node.play_url && !isTrackFolder(node)) {
      files.push({
        path: node.id,
        name: nameParts.join(" / ") || node.title || node.id,
        kind: "audio",
        url: node.play_url,
      });
    }
    node.children?.forEach((child) => visit(child, nameParts));
  }

  nodes.forEach((node) => visit(node, []));
  return files;
}

export function flattenSubtitleTracks(nodes: TrackNode[]): LibraryFile[] {
  const files: LibraryFile[] = [];

  function visit(node: TrackNode, ancestors: string[]) {
    const nameParts = [...ancestors, node.title].filter(Boolean);
    if (node.id && node.file_url && !isTrackFolder(node) && isSubtitleTrack(node)) {
      files.push({
        path: node.id,
        name: nameParts.join(" / ") || node.title || node.id,
        kind: "subtitle",
        url: node.file_url,
      });
    }
    node.children?.forEach((child) => visit(child, nameParts));
  }

  nodes.forEach((node) => visit(node, []));
  return files;
}

export function playNextTrack(
  audioFiles: LibraryFile[],
  currentPath: string,
  onSelect: (path: string) => void,
) {
  const currentIndex = audioFiles.findIndex((file) => file.path === currentPath);
  if (currentIndex >= 0 && currentIndex < audioFiles.length - 1) {
    onSelect(audioFiles[currentIndex + 1].path);
  }
}

export function isTrackFolder(node: TrackNode) {
  return node.type.toLowerCase().includes("folder") || Boolean(node.children?.length);
}

export function isSubtitleTrack(node: TrackNode) {
  const type = node.type.toLowerCase();
  const title = node.title.toLowerCase();
  return type.includes("subtitle") || /\.(lrc|srt|vtt|ass|ssa)$/i.test(title);
}

export function findSubtitleForAudio(subtitleFiles: LibraryFile[], audioFile?: LibraryFile) {
  if (!audioFile) {
    return undefined;
  }
  const audioBase = normalizeMediaBase(audioFile.name);
  const audioPathBase = normalizeMediaBase(audioFile.path);
  return subtitleFiles.find((file) => {
    const subtitleBase = normalizeMediaBase(file.name);
    const subtitlePathBase = normalizeMediaBase(file.path);
    return (
      subtitleBase === audioBase ||
      subtitlePathBase === audioPathBase ||
      subtitleBase.startsWith(audioBase) ||
      audioBase.startsWith(subtitleBase)
    );
  });
}

function normalizeMediaBase(value: string) {
  return value
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i, "")
    .toLowerCase();
}
