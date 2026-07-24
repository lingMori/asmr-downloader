import { useState } from "react";
import {
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  File,
  FileText,
  Folder,
  FolderOpen,
  Image,
  MusicNote,
  Subtitles,
  Video,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { EQ } from "@/components/ui";
import { formatSize, type FileTreeKind, type FileTreeNode } from "./tree";

export type FileTreeProps = {
  nodes: FileTreeNode[];
  /** 当前播放中的叶 id(行高亮 + EQ) */
  activeId?: string;
  /** 默认展开深度:0 = 全部折叠(详情页默认收起,避免长树一次铺开) */
  defaultExpandDepth?: number;
  /** 可预览叶(image/text/subtitle/video)点击 → 应用内预览 */
  onPreview?: (node: FileTreeNode) => void;
};

/**
 * 文件层级树(通用,递归渲染):文件夹行可折叠/展开;
 * 行 = 折叠箭头 / 类型图标 / 名称 / 右侧时长或大小 / 操作。
 * audio 叶=按钮(整作会话);image/text/subtitle/video 叶=应用内预览;
 * other 有 url=新窗口打开,无 url 灰显静态行。
 */
export function FileTree({ nodes, activeId, defaultExpandDepth = 0, onPreview }: FileTreeProps) {
  return (
    <div className="y-wd-tree">
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          activeId={activeId}
          defaultExpandDepth={defaultExpandDepth}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

const KIND_ICON: Record<Exclude<FileTreeKind, "folder">, typeof MusicNote> = {
  audio: MusicNote,
  subtitle: Subtitles,
  image: Image,
  text: FileText,
  video: Video,
  other: File,
};

const PREVIEWABLE: ReadonlySet<FileTreeKind> = new Set(["image", "text", "subtitle", "video"]);

type TreeRowProps = {
  node: FileTreeNode;
  depth: number;
  activeId?: string;
  defaultExpandDepth: number;
  onPreview?: (node: FileTreeNode) => void;
};

function TreeRow({ node, depth, activeId, defaultExpandDepth, onPreview }: TreeRowProps) {
  const [open, setOpen] = useState(depth < defaultExpandDepth);

  if (node.kind === "folder") {
    const FolderIcon = open ? FolderOpen : Folder;
    const ArrowIcon = open ? CaretDown : CaretRight;
    return (
      <div className="y-wd-tree__branch">
        <button
          type="button"
          className="y-wd-tree__row y-wd-tree__row--folder"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="y-wd-tree__arrow" aria-hidden="true">
            <ArrowIcon size={12} weight="bold" />
          </span>
          <span className="y-wd-tree__icon" aria-hidden="true">
            <FolderIcon size={15} />
          </span>
          <span className="y-wd-tree__name">{node.name}</span>
        </button>
        {open && (
          <div className="y-wd-tree__children">
            {(node.children ?? []).map((child) => (
              <TreeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                activeId={activeId}
                defaultExpandDepth={defaultExpandDepth}
                onPreview={onPreview}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const active = node.kind === "audio" && activeId === node.id;
  const LeafIcon = KIND_ICON[node.kind];
  const meta =
    node.duration != null ? formatDuration(node.duration) : formatSize(node.size);
  const external = node.kind === "other" && Boolean(node.url);
  const body = (
    <>
      <span className="y-wd-tree__arrow" aria-hidden="true" />
      <span className={cn("y-wd-tree__icon", active && "is-on")} aria-hidden="true">
        {active ? <EQ playing /> : <LeafIcon size={15} />}
      </span>
      <span className="y-wd-tree__name">{node.name}</span>
      {node.kind === "subtitle" && <span className="y-wd-tree__badge">字幕</span>}
      {meta && <span className="y-wd-tree__meta">{meta}</span>}
      {external && (
        <span className="y-wd-tree__open" aria-hidden="true">
          <ArrowSquareOut size={13} />
        </span>
      )}
    </>
  );

  if (node.kind === "audio" && node.onPlay) {
    return (
      <button
        type="button"
        className={cn("y-wd-tree__row", active && "is-on")}
        onClick={node.onPlay}
      >
        {body}
      </button>
    );
  }
  if (PREVIEWABLE.has(node.kind) && node.url && onPreview) {
    return (
      <button type="button" className="y-wd-tree__row" onClick={() => onPreview(node)}>
        {body}
      </button>
    );
  }
  if (external) {
    return (
      <a className="y-wd-tree__row" href={node.url} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  }
  return (
    <div
      className={cn(
        "y-wd-tree__row y-wd-tree__row--static",
        (node.kind === "other" || node.kind === "text") && "is-dim",
      )}
    >
      {body}
    </div>
  );
}
