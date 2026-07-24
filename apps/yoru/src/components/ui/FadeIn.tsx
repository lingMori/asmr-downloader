import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ENTER, ENTER_STAGGER, ENTER_STAGGER_WINDOW, ENTER_TRANSITION } from "@/lib/motion";

export type FadeInProps = {
  /** 列表下标;按 ENTER_STAGGER_WINDOW 取模错相,无限滚动追加批次也自然进入 */
  index?: number;
  className?: string;
  children: ReactNode;
};

/**
 * 列表/卡片进入过渡:fade + translateY 10px 轻 spring,间隔 40ms。
 * 只在挂载时跑一次 —— 已渲染项不会因追加加载重复动画(key 稳定即可)。
 */
export function FadeIn({ index = 0, className, children }: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial={ENTER.initial}
      animate={ENTER.animate}
      transition={{
        ...ENTER_TRANSITION,
        delay: (index % ENTER_STAGGER_WINDOW) * ENTER_STAGGER,
      }}
    >
      {children}
    </motion.div>
  );
}
