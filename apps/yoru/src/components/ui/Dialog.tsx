import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { DIALOG_IN, DIALOG_TRANSITION, EASE_OUT, SHEET_IN, SPRING_SOFT } from "@/lib/motion";
import { useMediaQuery } from "@/lib/useMediaQuery";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 无障碍标签 */
  label?: string;
  /** 点遮罩关闭,默认 true */
  closeOnOverlay?: boolean;
  className?: string;
  /** 卡片宽度(默认 min(440px, 100vw-56px));宽版内容(如文件预览)可覆盖;仅桌面生效,移动端 sheet 恒满宽 */
  width?: string;
};

/**
 * 模态对话框:
 * 桌面 = 遮罩 z50 + 居中卡 z51(dc.html:511-512),scale 进入,ESC/点遮罩关闭;
 * 移动(<768px)= 底部 sheet(iOS 动作表单范式):屏底滑入、顶部抓手、下拉手势关闭,
 * 高度上限 85dvh 内部滚动,底 padding 含 safe-area。
 */
export function Dialog({ open, onClose, children, label, closeOnOverlay = true, className, width }: DialogProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 下拉手势:速度或位移超阈值即关闭(与展开播放器同款阈值,橡皮筋回弹交给 SPRING_SOFT)
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.velocity.y > 500 || info.offset.y > 120) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onClick={closeOnOverlay ? onClose : undefined}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(10,6,18,.5)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              zIndex: "var(--z-dialog-overlay)" as never,
            }}
          />
          {isMobile ? (
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={label}
              initial={SHEET_IN.initial}
              animate={SHEET_IN.animate}
              exit={SHEET_IN.exit}
              transition={SPRING_SOFT}
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={onDragEnd}
              className={cn("y-dialog y-dialog--sheet", className)}
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: "var(--z-dialog)" as never,
                width: "100%",
                maxHeight: "85dvh",
                overflowY: "auto",
                background: "var(--panel)",
                border: "1px solid var(--glass-line-strong)",
                borderBottom: "none",
                borderRadius: "var(--r-xl) var(--r-xl) 0 0",
                backdropFilter: "blur(var(--glass-blur)) saturate(var(--glass-saturate))",
                WebkitBackdropFilter: "blur(var(--glass-blur)) saturate(var(--glass-saturate))",
                boxShadow: "var(--glass-highlight), var(--shadow-modal)",
                padding: "10px 22px calc(22px + env(safe-area-inset-bottom))",
              }}
            >
              <div
                className="y-dialog__grabber"
                aria-hidden="true"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => dragControls.start(e)}
              />
              {children}
            </motion.div>
          ) : (
            <motion.div
              key="card"
              role="dialog"
              aria-modal="true"
              aria-label={label}
              initial={DIALOG_IN.initial}
              animate={DIALOG_IN.animate}
              exit={DIALOG_IN.exit}
              transition={DIALOG_TRANSITION}
              className={cn("y-dialog", className)}
              style={{
                position: "fixed",
                left: "50%",
                top: "50%",
                // 居中偏移必须走 framer 受管值:动画 scale 会合成并覆盖 style.transform
                x: "-50%",
                y: "-50%",
                width: width ?? "min(440px,calc(100vw - 56px))",
                zIndex: "var(--z-dialog)" as never,
                background: "var(--panel)",
                border: "1px solid var(--glass-line-strong)",
                borderRadius: 20,
                backdropFilter: "blur(var(--glass-blur)) saturate(var(--glass-saturate))",
                WebkitBackdropFilter: "blur(var(--glass-blur)) saturate(var(--glass-saturate))",
                boxShadow: "var(--glass-highlight), var(--shadow-modal)",
                padding: 22,
              }}
            >
              {children}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
