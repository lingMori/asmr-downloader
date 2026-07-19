import { useQuery } from "@tanstack/react-query";
import { apiClient, type TaskListQuery } from "@/lib/api";
import { keys } from "@/lib/keys";
import { formatRelativeTime } from "@/lib/format";
import { Skeleton, Sticker } from "@/components/ui";
import { describeTask, resultSummary, sortRecentTasks } from "./taskDisplay";

const RECENT_FILTER: TaskListQuery = {
  type: ["download"],
  status: ["SUCCESS"],
  page: 1,
  pageSize: 5,
};

/** 最近完成卡(原型 dc.html:370-382):绿点 + 名称 + 相对时间(+ 结果摘要小字) */
export function RecentCard() {
  const recentQuery = useQuery({
    queryKey: keys.tasks.list(RECENT_FILTER),
    queryFn: () => apiClient.getTasks(RECENT_FILTER),
  });

  const tasks = sortRecentTasks(recentQuery.data?.items ?? []);

  return (
    <section className="y-tr-card" aria-label="最近完成">
      <Sticker section>最近完成 · かんりょう</Sticker>

      {recentQuery.isLoading && (
        <div className="y-tr-donelist">
          <Skeleton variant="row" count={2} />
        </div>
      )}

      {recentQuery.isError && (
        <div className="y-tr-error" role="alert">
          <span>
            最近完成加载失败:
            {recentQuery.error instanceof Error ? recentQuery.error.message : "未知错误"}
          </span>
          <button type="button" className="y-tr-act" onClick={() => void recentQuery.refetch()}>
            重试
          </button>
        </div>
      )}

      {recentQuery.isSuccess &&
        (tasks.length === 0 ? (
          <div className="y-tr-dim">还没有完成的任务</div>
        ) : (
          <div className="y-tr-donelist">
            {tasks.map((task) => {
              const display = describeTask(task);
              const summary = resultSummary(task);
              const title =
                display.rj && !display.title.includes(display.rj)
                  ? `${display.rj} ${display.title}`
                  : display.title;
              return (
                <div key={task.id} className="y-tr-done">
                  <span className="y-tr-done__dot" />
                  <div className="y-tr-done__body">
                    <div className="y-tr-done__line">
                      <span className="y-tr-done__title">{title}</span>
                      <span className="y-tr-done__time">
                        {formatRelativeTime(task.completed_at ?? task.updated_at)}
                      </span>
                    </div>
                    {summary && <div className="y-tr-done__sub">{summary}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </section>
  );
}
