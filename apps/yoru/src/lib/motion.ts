/**
 * framer-motion 共享动效参数,数值与 tokens.css 的动效令牌
 * (--dur-fast/--dur-med/--dur-slow、--ease-out/--ease-spring)对应。
 * 全局限速:main.tsx 的 MotionConfig reducedMotion="user" 在
 * prefers-reduced-motion 下自动跳过 transform/layout 动画。
 */

/** 标准减速(同 --ease-out):浮层/对话框/列表进入 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** 列表项进入:fade + translateY 10px(轻 spring,微 overshoot) */
export const ENTER = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
} as const;

/** 列表项进入间隔(秒);取模窗口 ≈ 一页条数,无限滚动追加批次自然错相 */
export const ENTER_STAGGER = 0.04;
export const ENTER_STAGGER_WINDOW = 20;

export const ENTER_TRANSITION = { type: "spring", stiffness: 260, damping: 24 } as const;

/** 浮层弹簧(播放条→展开播放器/批量栏):有质量感但不回弹过度 */
export const SPRING_SOFT = { type: "spring", stiffness: 380, damping: 34 } as const;

/** 对话框:scale 0.95→1 + fade */
export const DIALOG_IN = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
} as const;

export const DIALOG_TRANSITION = { duration: 0.24, ease: EASE_OUT } as const;

/** 底部表单(移动端 Dialog sheet):从屏底滑入/滑出,配合 SPRING_SOFT */
export const SHEET_IN = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
} as const;
