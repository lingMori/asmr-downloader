import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("apiClient task filters", () => {
  it("serializes repeated task type and status filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      code: "OK",
      data: { items: [], total: 0, page: 1, size: 20 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

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
