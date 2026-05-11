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
