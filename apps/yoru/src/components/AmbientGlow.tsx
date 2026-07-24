import { lazy, Suspense, useMemo } from "react";
import { cn } from "@/lib/utils";
import { glowPalette } from "@/lib/glow";
import { useCoverGlow } from "@/hooks/useCoverGlow";
import { useGlobalPlayer } from "@/player";
import type { AmbientGlowCanvasProps } from "./AmbientGlowCanvas";

const AmbientGlowCanvas = lazy(() =>
  import("./AmbientGlowCanvas").then((m) => ({ default: m.AmbientGlowCanvas })),
);

/**
 * 环境氛围层(壳挂载一次):封面主色渗透背景的动态光晕 + 胶片颗粒。
 * 播放/暂停整屏氛围有差别(速度/透明度);z-index -1,不遮内容。
 * shader 层 lazy 分包,不进首屏 bundle。
 */
export function AmbientGlow() {
  const { session, playing } = useGlobalPlayer();
  const color = useCoverGlow(
    session?.coverUrl,
    session?.sourceId ?? session?.workTitle ?? "yoru",
  );
  const colors = useMemo(() => glowPalette(color), [color]);
  const canvasProps: AmbientGlowCanvasProps = { colors, playing };
  return (
    <div className={cn("y-ambient", playing && "is-playing")} aria-hidden="true">
      <Suspense fallback={null}>
        <AmbientGlowCanvas {...canvasProps} />
      </Suspense>
    </div>
  );
}
