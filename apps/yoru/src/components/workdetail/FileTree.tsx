import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { formatSize, type FileTreeNode } from "./tree";

export type FileTreeProps = {
  nodes: FileTreeNode[];
  /** 当前播放中的叶 id(行高亮 + ♪) */
  activeId?: string;
  /** 默认展开深度:1 = 第一层文件夹展开、更深层折叠 */
  defaultExpandDepth?: number;
};

/**
 * 文件层级树(通用,递归渲染):文件夹行可折叠/展开;
 * 行 = 折叠箭头 / 类型图标 / 名称 / 右侧时长或大小 / 操作。
 * audio 叶=按钮(整作会话);image 叶=新窗口打开;subtitle 叶=「字幕」badge;
 * text/other 灰显静态行。
 */
export function FileTree({ nodes, activeId, defaultExpandDepth = 1 }: FileTreeProps) {
  return (
    <div className="y-wd-tree">
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          activeId={activeId}
          defaultExpandDepth={defaultExpandDepth}
        />
      ))}
    </div>
  );
}

const KIND_ICON: Record<Exclude<FileTreeNode["kind"], "folder">, string> = {
  audio: "♪",
  subtitle: "字",
  image: "图",
  text: "文",
  other: "·",
};

type TreeRowProps = {
  node: FileTreeNode;
  depth: number;
  activeId?: string;
  defaultExpandDepth: number;
};

function TreeRow({ node, depth, activeId, defaultExpandDepth }: TreeRowProps) {
  const [open, setOpen] = useState(depth < defaultExpandDepth);

  if (node.kind === "folder") {
    return (
      <div className="y-wd-tree__branch">
        <button
          type="button"
          className="y-wd-tree__row y-wd-tree__row--folder"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="y-wd-tree__arrow" aria-hidden="true">
            {open ? "▾" : "▸"}
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const active = node.kind === "audio" && activeId === node.id;
  const meta =
    node.duration != null ? formatDuration(node.duration) : formatSize(node.size);
  const body = (
    <>
      <span className="y-wd-tree__arrow" aria-hidden="true" />
      <span className={cn("y-wd-tree__icon", active && "is-on")} aria-hidden="true">
        {active ? "♪" : KIND_ICON[node.kind]}
      </span>
      <span className="y-wd-tree__name">{node.name}</span>
      {node.kind === "subtitle" && <span className="y-wd-tree__badge">字幕</span>}
      {meta && <span className="y-wd-tree__meta">{meta}</span>}
      {node.kind === "image" && node.url && (
        <span className="y-wd-tree__open" aria-hidden="true">
          ↗
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
  if (node.kind === "image" && node.url) {
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
