import { describe, expect, it, vi } from "vitest";
import { createFeedbackTracker, type FeedbackType } from "./feedback";

function makeSender() {
  const calls: Array<{ sourceId: string; type: FeedbackType }> = [];
  const send = vi.fn(async (sourceId: string, type: FeedbackType) => {
    calls.push({ sourceId, type });
  });
  return { calls, send };
}

/** Flush pending promises so fire-and-forget sends settle. */
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createFeedbackTracker", () => {
  it("emits start-listen once per work even across restarts", async () => {
    const { calls, send } = makeSender();
    const tracker = createFeedbackTracker(send);

    tracker.start("RJ1001");
    tracker.start("RJ1001");
    tracker.start("RJ1002");
    await flush();

    expect(calls).toEqual([
      { sourceId: "RJ1001", type: "start-listen" },
      { sourceId: "RJ1002", type: "start-listen" },
    ]);
  });

  it("emits time milestones from accumulated playback and ignores seeks", async () => {
    const { calls, send } = makeSender();
    const tracker = createFeedbackTracker(send);

    tracker.start("RJ2001");
    // After ticks 1..300 the tracker has seen 299 accumulated seconds.
    for (let second = 1; second <= 300; second += 1) {
      tracker.tick("RJ2001", second, 3600);
    }
    await flush();
    expect(calls.filter((call) => call.type === "listen-5mins")).toEqual([]);

    tracker.tick("RJ2001", 301, 3600);
    await flush();
    expect(calls.filter((call) => call.type === "listen-5mins")).toEqual([
      { sourceId: "RJ2001", type: "listen-5mins" },
    ]);

    // A seek jump (>5s delta) must not count as played time.
    tracker.tick("RJ2001", 1200, 3600);
    tracker.tick("RJ2001", 1201, 3600);
    await flush();
    const fiveMinReports = calls.filter((call) => call.type === "listen-5mins");
    const fifteenMinReports = calls.filter((call) => call.type === "listen-15mins");
    expect(fiveMinReports).toHaveLength(1);
    expect(fifteenMinReports).toEqual([]);
  });

  it("emits listen-30percent when the position passes 30% of duration", async () => {
    const { calls, send } = makeSender();
    const tracker = createFeedbackTracker(send);

    tracker.start("RJ3001");
    tracker.tick("RJ3001", 29, 100);
    tracker.tick("RJ3001", 30, 100);
    tracker.tick("RJ3001", 45, 100);
    await flush();

    expect(calls.filter((call) => call.type === "listen-30percent")).toEqual([
      { sourceId: "RJ3001", type: "listen-30percent" },
    ]);
  });

  it("reports each milestone only once per work", async () => {
    const { calls, send } = makeSender();
    const tracker = createFeedbackTracker(send);

    tracker.start("RJ4001");
    for (let second = 1; second <= 305; second += 1) {
      tracker.tick("RJ4001", second, 1000);
    }
    // Simulate a later session for the same work.
    tracker.start("RJ4001");
    for (let second = 1; second <= 305; second += 1) {
      tracker.tick("RJ4001", second, 1000);
    }
    await flush();

    expect(calls.filter((call) => call.type === "start-listen")).toHaveLength(1);
    expect(calls.filter((call) => call.type === "listen-5mins")).toHaveLength(1);
    expect(tracker.sentFor("RJ4001")).toEqual(
      new Set(["start-listen", "listen-5mins", "listen-30percent"]),
    );
  });

  it("swallows sender failures", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const send = vi.fn(() => Promise.reject(new Error("network down")));
    const tracker = createFeedbackTracker(send);

    tracker.start("RJ5001");
    await flush();

    expect(send).toHaveBeenCalledWith("RJ5001", "start-listen");
    expect(debug).toHaveBeenCalled();
    debug.mockRestore();
  });
});
