/** 展示格式化小工具(纯函数) */

/** 秒 → 时长文本:>=1h 为 h:mm:ss,否则 m:ss;无效输入返回 "--:--" */
export function formatDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 整数加千分位:12408 → "12,408" */
export function formatCount(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US");
}

/** 评分保留两位:4.8 → "4.80" */
export function formatRate(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(2);
}

/** ISO/RFC3339 或 YYYYMMDD → YYYY-MM-DD;无法识别时原样返回 */
export function formatDate(raw?: string | null): string {
  if (!raw) return "";
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** RFC3339 → "今天 09:12" / "MM-DD HH:mm" */
export function formatRelativeTime(raw?: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `今天 ${hm}`;
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${hm}`;
}
