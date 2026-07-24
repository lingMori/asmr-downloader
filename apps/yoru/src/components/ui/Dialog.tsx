import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DIALOG_IN, DIALOG_TRANSITION, EASE_OUT } from "@/lib/motion";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 无障碍标签 */
  label?: string;
  /** 点遮罩关闭,默认 true */
  closeOnOverlay?: boolean;
  className?: string;
  /** 卡片宽度(默认 min(440px, 100vw-56px));宽版内容(如文件预览)可覆盖 */
  width?: string;
};

/** 模态对话框:遮罩 z50 + 居中卡 z51(dc.html:511-512),framer-motion 进出,ESC/点遮罩关闭 */
export function Dialog({ open, onClose, children, label, closeOnOverlay = true, className, width }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
