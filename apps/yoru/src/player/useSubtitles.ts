import { useEffect, useState } from "react";
import {
  decodeSubtitleBuffer,
  parseSubtitleText,
  type SubtitleCue,
} from "@/lib/subtitles";

export type SubtitleState = "idle" | "loading" | "ready" | "error";

/**
 * 拉取并解析当前曲目的字幕(lrc/srt/vtt/ass)。
 * url 为空 → idle;解析出 0 行也视为 ready(由 UI 决定空态文案)。
 */
export function useSubtitles(url?: string, name?: string) {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [state, setState] = useState<SubtitleState>("idle");

  useEffect(() => {
    if (!url) {
      setCues([]);
      setState("idle");
      return;
    }
    const controller = new AbortController();
    setCues([]);
    setState("loading");
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response
          .arrayBuffer()
          .then((buffer) =>
            decodeSubtitleBuffer(buffer, response.headers.get("Content-Type") || ""),
          );
      })
      .then((text) => {
        setCues(parseSubtitleText(text, name ?? url));
        setState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        console.warn("[yoru player] subtitle load failed", { url, error });
        setCues([]);
        setState("error");
      });
    return () => controller.abort();
  }, [url, name]);

  return { cues, state };
}
