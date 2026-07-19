import { describe, expect, it } from "vitest";
import { keys } from "./keys";

describe("keys", () => {
  it("worksStatus normalizes ids (sort + dedupe)", () => {
    expect(keys.worksStatus(["RJ2", "RJ1", "RJ2"])).toEqual(["works-status", "RJ1", "RJ2"]);
    expect(keys.worksStatus()).toEqual(["works-status"]);
  });

  it("tasks summary shares the tasks prefix", () => {
    expect(keys.tasks.summary[0]).toBe("tasks");
    expect(keys.tasks.list({ page: 1 })).toEqual(["tasks", "list", { page: 1 }]);
  });

  it("static keys are stable literals", () => {
    expect(keys.health).toEqual(["health"]);
    expect(keys.sync.report).toEqual(["sync", "report"]);
    expect(keys.config).toEqual(["config"]);
    expect(keys.authStatus).toEqual(["auth", "status"]);
    expect(keys.playback.latest(3)).toEqual(["playback", "latest", 3]);
  });
});
