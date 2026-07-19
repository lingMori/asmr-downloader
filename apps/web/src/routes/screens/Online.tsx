import { PageHeader, EmptyState } from "@/components/ui/sweet";

export function Online() {
  return (
    <section>
      <PageHeader
        kicker="在线"
        title="在线 · おんらいん"
        description="继续收听、热门与推荐串流将在这一阶段之后接入，当前为占位屏幕。"
      />
      <EmptyState
        symbol="おんらいん"
        title="建设中"
        description="在线收听首页正在改造：继续收听卡片、热门榜与为你推荐会陆续上线。"
      />
    </section>
  );
}
