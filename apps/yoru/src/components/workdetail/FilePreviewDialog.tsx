import { useEffect, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { Dialog, Skeleton } from "@/components/ui";
import type { FileTreeNode } from "./tree";

export type FilePreviewDialogProps = {
  /** 当前预览的文件叶;null = 关闭 */
  node: FileTreeNode | null;
  onClose: () => void;
};

/**
 * 非音频文件应用内预览(详情页文件树):
 * image=灯箱 / video=<video> / text·subtitle=内嵌文本查看器。
 * 远端文本经上游绝对 URL 拉取,可能被 CORS 拦——失败时给「新窗口打开」兜底。
 */
export function FilePreviewDialog({ node, onClose }: FilePreviewDialogProps) {
  return (
    <Dialog
      open={node !== null}
      onClose={onClose}
      label={node ? `预览 ${node.name}` : undefined}
      width="min(880px,calc(100vw - 32px))"
      className="y-preview-dialog"
    >
      {node && (
        <>
          <div className="y-preview-head">
            <span className="y-preview-head__name" title={node.name}>
              {node.name}
            </span>
            <a
              className="y-preview-head__open"
              href={node.url}
              target="_blank"
              rel="noreferrer"
            >
              新窗口打开
              <ArrowSquareOut size={13} />
            </a>
          </div>
          <PreviewBody node={node} />
        </>
      )}
    </Dialog>
  );
}

function PreviewBody({ node }: { node: FileTreeNode }) {
  if (!node.url) {
    return <div className="y-preview-fallback">该文件没有可预览的地址。</div>;
  }
  if (node.kind === "image") {
    return (
      <div className="y-preview-media">
        <img src={node.url} alt={node.name} />
      </div>
    );
  }
  if (node.kind === "video") {
    return (
      <div className="y-preview-media">
        {/* 原生播放即可,跨域媒体不受 CORS 限制 */}
        <video src={node.url} controls preload="metadata" />
      </div>
    );
  }
  return <TextPreview url={node.url} name={node.name} />;
}

type TextState =
  | { status: "loading" }
  | { status: "ok"; text: string }
  | { status: "error"; message: string };

/** 文本/字幕内嵌查看器:静态文件流直 fetch(AGENTS.md 豁免);UTF-8 优先,乱码回退 Shift-JIS */
function TextPreview({ url, name }: { url: string; name: string }) {
  const [state, setState] = useState<TextState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (cancelled) return;
        setState({ status: "ok", text: decodeText(buf) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "加载失败",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.status === "loading") {
    return (
      <div className="y-preview-textload" aria-label={`加载 ${name}`}>
        <Skeleton variant="row" count={4} />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="y-preview-fallback">
        预览失败({state.message})。可能是跨域限制,请用右上角「新窗口打开」。
      </div>
    );
  }
  return <pre className="y-preview-text">{state.text}</pre>;
}

/** UTF-8 解码;替换符过多(日文老文件常见 Shift-JIS)时换 Shift-JIS 重解,取替换符更少者 */
function decodeText(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8;
  try {
    const sjis = new TextDecoder("shift-jis").decode(buf);
    return countReplacement(sjis) < countReplacement(utf8) ? sjis : utf8;
  } catch {
    return utf8;
  }
}

function countReplacement(text: string): number {
  return (text.match(/�/g) ?? []).length;
}
