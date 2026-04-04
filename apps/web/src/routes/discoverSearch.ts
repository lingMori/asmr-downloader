export type DiscoverRouteSearch = {
  q: string;
  tag: string;
  circle: string;
  va: string;
  subtitle: boolean;
  count: number;
  order: string;
  sort: string;
  page: number;
};

export const defaultDiscoverRouteSearch: DiscoverRouteSearch = {
  q: "",
  tag: "",
  circle: "",
  va: "",
  subtitle: false,
  count: 24,
  order: "dl_count",
  sort: "desc",
  page: 1,
};

const allowedOrders = new Set([
  "dl_count",
  "release",
  "rate_average_2dp",
  "review_count",
  "price",
]);

export function validateDiscoverSearch(
  raw: Record<string, unknown>,
): DiscoverRouteSearch {
  return {
    q: getString(raw.q),
    tag: getString(raw.tag),
    circle: getString(raw.circle),
    va: getString(raw.va),
    subtitle: getBoolean(raw.subtitle),
    count: getPositiveInt(raw.count, defaultDiscoverRouteSearch.count, 1, 200),
    order: getOrder(raw.order),
    sort: getSort(raw.sort),
    page: getPositiveInt(raw.page, defaultDiscoverRouteSearch.page, 1, 9999),
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function getPositiveInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const rounded = Math.round(numeric);
  return Math.min(max, Math.max(min, rounded));
}

function getOrder(value: unknown) {
  const next = getString(value);
  return allowedOrders.has(next) ? next : defaultDiscoverRouteSearch.order;
}

function getSort(value: unknown) {
  return getString(value) === "asc" ? "asc" : defaultDiscoverRouteSearch.sort;
}
