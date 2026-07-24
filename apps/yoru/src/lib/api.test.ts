import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api";

afterEach(() => vi.restoreAllMocks());

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ code: "OK", data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiClient task filters", () => {
  it("serializes repeated task type and status filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      items: [], total: 0, page: 1, size: 20,
    }));

    await apiClient.getTasks({
      type: ["sync", "sync-download"],
      status: ["QUEUED", "RUNNING"],
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("type=sync");
    expect(url).toContain("type=sync-download");
    expect(url).toContain("status=QUEUED");
    expect(url).toContain("status=RUNNING");
  });
});

describe("apiClient discover 封面", () => {
  it("在线列表封面改写成同源 /cover 代理(canvas 取色需要同源)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      items: [
        {
          source_id: "RJ01588205",
          title: "x",
          thumbnail_url: "https://api.asmr-300.com/api/cover/1588205.jpg?type=240x240",
          main_cover_url: "https://api.asmr-300.com/api/cover/1588205.jpg?type=main",
        },
      ],
      page: 1,
      page_size: 24,
      total: 1,
    }));

    const res = await apiClient.getPopularWorks({ page: 1, pageSize: 24 });
    const work = res.items[0];
    expect(work.thumbnail_url).toBe("/api/discover/works/RJ01588205/cover?type=240x240");
    expect(work.main_cover_url).toBe("/api/discover/works/RJ01588205/cover?type=main");
  });

  it("无封面的作品不造代理死链", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      items: [{ source_id: "RJ1", title: "y" }],
      page: 1,
      page_size: 24,
      total: 1,
    }));

    const res = await apiClient.getPopularWorks({ page: 1, pageSize: 24 });
    expect(res.items[0].thumbnail_url).toBeUndefined();
    expect(res.items[0].main_cover_url).toBeUndefined();
  });
});

