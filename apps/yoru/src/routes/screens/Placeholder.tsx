import { useParams } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui";

/** Phase 1 占位屏:后续 Phase 逐页替换为真实实现 */
export function Placeholder({ name, kana }: { name: string; kana: string }) {
  return (
    <div className="y-page">
      <EmptyState>
        <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{name}</div>
        <div>
          建设中 · こうじちゅう<span className="y-kana" style={{ marginLeft: 8 }}>{kana}</span>
        </div>
      </EmptyState>
    </div>
  );
}

export function PlaceholderDetail({ name, kana }: { name: string; kana: string }) {
  const params = useParams({ strict: false }) as { id?: string };
  return (
    <div className="y-page">
      <EmptyState>
        <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>
          {name}
          {params.id ? ` · ${params.id}` : ""}
        </div>
        <div>
          建设中 · こうじちゅう<span className="y-kana" style={{ marginLeft: 8 }}>{kana}</span>
        </div>
      </EmptyState>
    </div>
  );
}
