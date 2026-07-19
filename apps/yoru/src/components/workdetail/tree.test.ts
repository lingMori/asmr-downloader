import { describe, expect, it, vi } from "vitest";
import type { LibraryFile, TrackNode } from "@/lib/api";
import {
  attachPlayHandlers,
  buildLocalFileTree,
  buildRemoteTrackTree,
  flattenLeaves,
  formatSize,
} from "./tree";

describe("buildLocalFileTree(路径 → 树)", () => {
  const files: LibraryFile[] = [
    { path: "RJ1/SE/01 耳かき.mp3", name: "01 耳かき.mp3", kind: "audio", url: "/media/RJ1/SE/01.mp3" },
    { path: "RJ1/SE/02 ささやき.mp3", name: "02 ささやき.mp3", kind: "audio", url: "/media/RJ1/SE/02.mp3" },
    { path: "RJ1/SE/01 耳かき.lrc", name: "01 耳かき.lrc", kind: "subtitle", url: "/media/RJ1/SE/01.lrc" },
    { path: "RJ1/cover.jpg", name: "cover.jpg", kind: "image", url: "/media/RJ1/cover.jpg" },
    { path: "readme.txt", name: "readme.txt", kind: "other", url: "/media/readme.txt" },
  ];

  it("按 path 分段建文件夹(同名文件夹复用),叶带 kind/url", () => {
    const tree = buildLocalFileTree(files);
    expect(tree.map((n) => [n.name, n.kind])).toEqual([
      ["RJ1", "folder"],
      ["readme.txt", "other"],
    ]);

    const rj1 = tree[0];
    expect(rj1.children?.map((n) => [n.name, n.kind])).toEqual([
      ["SE", "folder"],
      ["cover.jpg", "image"],
    ]);

    const se = rj1.children![0];
    expect(se.children?.map((n) => [n.name, n.kind])).toEqual([
      ["01 耳かき.mp3", "audio"],
      ["02 ささやき.mp3", "audio"],
      ["01 耳かき.lrc", "subtitle"],
    ]);
    expect(se.children![0]).toMatchObject({ id: "RJ1/SE/01 耳かき.mp3", url: "/media/RJ1/SE/01.mp3" });
  });

  it("flattenLeaves:DFS 拍平且可按 kind 过滤(folder 不返回)", () => {
    const tree = buildLocalFileTree(files);
    expect(flattenLeaves(tree, "audio").map((n) => n.name)).toEqual([
      "01 耳かき.mp3",
      "02 ささやき.mp3",
    ]);
    expect(flattenLeaves(tree, "subtitle").map((n) => n.url)).toEqual(["/media/RJ1/SE/01.lrc"]);
    expect(flattenLeaves(tree).every((n) => n.kind !== "folder")).toBe(true);
  });

  it("attachPlayHandlers:audio 叶 onPlay 下标 = DFS 序", () => {
    const tree = buildLocalFileTree(files);
    const play = vi.fn();
    const withPlay = attachPlayHandlers(tree, play);
    const audio = flattenLeaves(withPlay, "audio");
    expect(audio).toHaveLength(2);
    audio[1].onPlay!();
    expect(play).toHaveBeenCalledWith(1);
    audio[0].onPlay!();
    expect(play).toHaveBeenCalledWith(0);
    // 原树不被改写
    expect(flattenLeaves(tree, "audio")[0].onPlay).toBeUndefined();
  });
});

describe("buildRemoteTrackTree(TrackNode → 树)", () => {
  const tracks: TrackNode[] = [
    {
      id: "0",
      type: "folder",
      title: "本編",
      children: [
        { id: "0.0", type: "audio", title: "01.mp3", play_url: "/api/works/RJ1/tracks/0.0/stream" },
        { id: "0.1", type: "subtitle", title: "01.lrc", file_url: "/api/works/RJ1/tracks/0.1/file" },
        { id: "0.2", type: "text", title: "台本.txt" },
      ],
    },
    { id: "1", type: "image", title: "cover.jpg", media_download_url: "/dl/cover.jpg" },
  ];

  it("folder/audio/subtitle/text/image 映射,url 保留", () => {
    const tree = buildRemoteTrackTree(tracks);
    expect(tree.map((n) => [n.name, n.kind])).toEqual([
      ["本編", "folder"],
      ["cover.jpg", "image"],
    ]);
    const leaves = flattenLeaves(tree);
    expect(leaves.map((n) => n.kind)).toEqual(["audio", "subtitle", "text", "image"]);
    expect(leaves[0].url).toBe("/api/works/RJ1/tracks/0.0/stream");
    expect(leaves[1].url).toBe("/api/works/RJ1/tracks/0.1/file");
    expect(leaves[3].url).toBe("/dl/cover.jpg");
  });

  it("宽松读取 size/duration;无 play_url 的 audio 类型不算可播叶", () => {
    const tree = buildRemoteTrackTree([
      { id: "a", type: "audio", title: "x.mp3", play_url: "/s", size: 2048, duration: 61 } as TrackNode,
      { id: "b", type: "audio", title: "y.mp3" },
    ]);
    const [x, y] = flattenLeaves(tree);
    expect(x).toMatchObject({ kind: "audio", size: 2048, duration: 61 });
    expect(y.kind).toBe("other");
  });
});

describe("formatSize", () => {
  it("字节 → KB/MB/GB;无效输入空串", () => {
    expect(formatSize(undefined)).toBe("");
    expect(formatSize(0)).toBe("");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(5 * 1024 ** 2)).toBe("5.0 MB");
    expect(formatSize(2 * 1024 ** 3)).toBe("2.00 GB");
  });
});
