import "@/styles/pages/transfer.css";
import { QueueCard } from "@/components/transfer/QueueCard";
import { RecentCard } from "@/components/transfer/RecentCard";
import { SyncCard } from "@/components/transfer/SyncCard";

/**
 * Phase 5:传输中心(原型 dc.html:324-386)
 * 桌面 左 1.55fr 下载队列 + 右 1fr(同步 + 最近完成);≤1100 单列堆叠。
 */
export function TransferScreen() {
  return (
    <div className="y-page">
      <div className="y-tr-grid">
        <QueueCard />
        <div className="y-tr-side">
          <SyncCard />
          <RecentCard />
        </div>
      </div>
    </div>
  );
}
