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

  const audioNames = mediaStems(audioFile);
  const audioDirectory = mediaDirectory(audioFile);
  const candidates = subtitleFiles
    .map((file, index) => {
      const subtitleNames = mediaStems(file);
      const exact = subtitleNames.some((name) => audioNames.includes(name));
      const normalized = subtitleNames.some((name) =>
        audioNames.some((audioName) => normalizeComparableStem(name) === normalizeComparableStem(audioName))
      );
      return {
        file,
        index,
        exact,
        normalized,
        sameDirectory: Boolean(audioDirectory && mediaDirectory(file) === audioDirectory),
      };
    })
    .filter((candidate) => candidate.exact || candidate.normalized)
    .sort((a, b) =>
      Number(b.sameDirectory) - Number(a.sameDirectory) ||
      Number(b.exact) - Number(a.exact) ||
      a.index - b.index
    );

  return candidates[0]?.file;
}

function mediaStems(file: LibraryFile) {
  return Array.from(new Set([file.name, file.path].map(normalizeMediaBase).filter(Boolean)));
}

function normalizeMediaBase(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.(lrc|srt|vtt|ass|ssa)$/i, "")
    .replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i, "")
    .trim()
    .toLowerCase();
}

function normalizeComparableStem(value: string) {
  return value.normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "").toLowerCase();
}

function mediaDirectory(file: LibraryFile) {
  const source = file.path.includes("/") || file.path.includes("\\") ? file.path : file.name;
  const parts = source.normalize("NFKC").replace(/\\/g, "/").split("/");
  parts.pop();
  return parts.join("/").trim().toLowerCase();
}
