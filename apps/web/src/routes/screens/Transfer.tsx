import { PageHeader, EmptyState } from "@/components/ui/sweet";

export function Transfer() {
  return (
    <section>
      <PageHeader
        kicker="传输"
        title="传输 · でんそう"
        description="下载队列与同步任务将合并到这里，当前为占位屏幕；旧版入口暂时保留在 /queue 与 /sync。"
      />
      <EmptyState
        symbol="でんそう"
        title="建设中"
        description="传输中心正在改造：任务队列、失败重试与批量下载会统一收拢到本页。"
      />
    </section>
  );
}
