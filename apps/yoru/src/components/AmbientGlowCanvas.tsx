import { Component, useState, type ReactNode } from "react";
import { MeshGradient } from "@paper-design/shaders-react";
import { useReducedMotion } from "framer-motion";

export type AmbientGlowCanvasProps = {
  /** glowPalette 派生的 4 色 */
  colors: string[];
  playing: boolean;
};

/**
 * WebGL 环境光晕(@paper-design/shaders-react MeshGradient):
 * 播放 = speed 0.5 缓慢漂移,暂停 = speed 0.08 近乎凝固,
 * reduced-motion = 完全静止(frame 定格)。
 * 无 WebGL2(jsdom/老 webview)→ 直接 CSS 保底,不让 shader 初始化抛出未处理拒绝。
 */
export function AmbientGlowCanvas({ colors, playing }: AmbientGlowCanvasProps) {
  const reduced = useReducedMotion();
  const [supported] = useState(supportsWebGL2);
  if (!supported) {
    return <CssGlowFallback colors={colors} />;
  }
  const speed = reduced ? 0 : playing ? 0.5 : 0.08;
  return (
    <GlowErrorBoundary colors={colors}>
      <MeshGradient
        colors={colors}
        speed={speed}
        distortion={0.8}
        swirl={0.1}
        grainMixer={0.45}
        grainOverlay={0.35}
        maxPixelCount={262144}
        style={{ width: "100%", height: "100%" }}
      />
    </GlowErrorBoundary>
  );
}

function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

/** CSS 保底光晕(同色板,静态径向渐变) */
function CssGlowFallback({ colors }: { colors: string[] }) {
  const [deep, main, warm] = colors;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `radial-gradient(60% 55% at 22% 18%, ${main} 0%, transparent 72%),
          radial-gradient(55% 60% at 82% 78%, ${warm} 0%, transparent 70%),
          radial-gradient(120% 120% at 50% 50%, transparent 40%, ${deep} 100%)`,
      }}
    />
  );
}

type BoundaryProps = { colors: string[]; children: ReactNode };
type BoundaryState = { failed: boolean };

/** WebGL 挂载失败时的二次保底(主防线是上面的 webgl2 预检) */
class GlowErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    /* shader 层失败静默降级,氛围层不应打断应用 */
  }

  render() {
    if (this.state.failed) {
      return <CssGlowFallback colors={this.props.colors} />;
    }
    return this.props.children;
  }
}
