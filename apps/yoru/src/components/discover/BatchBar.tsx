import { AnimatePresence, motion } from "framer-motion";
import { DownloadSimple } from "@phosphor-icons/react";
import { Sticker } from "@/components/ui";
import { SPRING_SOFT } from "@/lib/motion";

export type BatchBarProps = {
  count: number;
  onClear: () => void;
  onEnqueue: () => void;
};

/** 批量入队栏(dc.html:465-472):有勾选时贴底出现(桌面避播放条/移动避 tab bar) */
export function BatchBar({ count, onClear, onEnqueue }: BatchBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="disc-batchbar"
          className="y-disc-batchbar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={SPRING_SOFT}
        >
          <Sticker color="pink" rotate={-2} className="y-sticker--inline" style={{ flex: "none" }}>
            已选 {count} 件
          </Sticker>
          <span className="y-disc-batchbar__note">复核后可一起加入传输队列</span>
          <span className="y-disc-batchbar__spacer" />
          <button type="button" className="y-btn-ghost" onClick={onClear}>
            清空选择
          </button>
          <button type="button" className="y-btn-primary" onClick={onEnqueue}>
            <DownloadSimple size={14} weight="bold" /> 批量加入传输队列
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
