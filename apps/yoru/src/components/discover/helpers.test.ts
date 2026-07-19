import { describe, expect, it } from "vitest";
import {
  buildExportQuery,
  coverColorFor,
  DEFAULT_DISCOVER_URL,
  isAdvancedQuery,
  parseDiscoverSearch,
  splitTags,
  toDiscoverSearch,
} from "./helpers";

describe("discover helpers", () => {
  it("splitTags:逗号/中文逗号/换行分隔,去空白", () => {
    expect(splitTags("耳语, 催眠，治愈\n掏耳,, ")).toEqual(["耳语", "催眠", "治愈", "掏耳"]);
    expect(splitTags("")).toEqual([]);
  });

  it("isAdvancedQuery:含 $ 即高级语法", () => {
    expect(isAdvancedQuery("$tag:耳语$")).toBe(true);
    expect(isAdvancedQuery("RJ123")).toBe(false);
    expect(isAdvancedQuery("")).toBe(false);
  });

  it("buildExportQuery:q 原样 + $tag:x$ $circle:y$ $va:z$ 逐个拼", () => {
    expect(
      buildExportQuery({
        ...DEFAULT_DISCOVER_URL,
        q: "雨音",
        tags: ["耳语", "催眠"],
        circle: "雨音シアター",
        va: "篝火ほたる",
      }),
    ).toBe("雨音 $tag:耳语$ $tag:催眠$ $circle:雨音シアター$ $va:篝火ほたる$");
    expect(buildExportQuery(DEFAULT_DISCOVER_URL)).toBe("");
  });

  it("parseDiscoverSearch:缺省/非法值回退默认,subtitle=1,page_size 只认 12/24/48(无 page,无限滚动)", () => {
    expect(parseDiscoverSearch({})).toEqual(DEFAULT_DISCOVER_URL);
    expect(
      parseDiscoverSearch({
        q: "abc",
        tags: "a,b",
        subtitle: "1",
        order: "price",
        sort: "asc",
        page_size: "48",
        work: "RJ001",
      }),
    ).toEqual({
      q: "abc",
      tags: ["a", "b"],
      circle: "",
      va: "",
      subtitle: true,
      order: "price",
      sort: "asc",
      pageSize: 48,
      work: "RJ001",
    });
    expect(parseDiscoverSearch({ order: "nope", page_size: "99" })).toEqual(
      DEFAULT_DISCOVER_URL,
    );
    // 历史 URL 里的 page 参数直接忽略,不进入规范状态
    expect(parseDiscoverSearch({ page: "3" })).toEqual(DEFAULT_DISCOVER_URL);
  });

  it("toDiscoverSearch:默认值省略,与 parse 往返一致", () => {
    expect(toDiscoverSearch(DEFAULT_DISCOVER_URL)).toEqual({});
    const raw = { q: "x", tags: "a", page_size: "12", work: "RJ9" };
    expect(parseDiscoverSearch(toDiscoverSearch(parseDiscoverSearch(raw)))).toEqual(
      parseDiscoverSearch(raw),
    );
  });

  it("coverColorFor:同一 id 稳定取色", () => {
    expect(coverColorFor("RJ001")).toBe(coverColorFor("RJ001"));
    expect(["lav", "rose", "blue", "plum"]).toContain(coverColorFor("RJ001"));
  });
});
