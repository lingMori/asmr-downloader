import { beforeEach, describe, expect, it } from "vitest";
import { detectPlatform, initPlatform, isDesktop, PLATFORM_STORAGE_KEY } from "./platform";

function setSearch(search: string) {
  window.history.replaceState(null, "", `/${search}`);
}

describe("platform", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setSearch("");
    delete document.documentElement.dataset.platform;
  });

  it("defaults to web with no param and no storage", () => {
    expect(detectPlatform()).toBe("web");
  });

  it("detects desktop from ?desktop=1", () => {
    setSearch("?desktop=1");
    expect(detectPlatform()).toBe("desktop");
  });

  it("falls back to persisted desktop when param is absent", () => {
    window.localStorage.setItem(PLATFORM_STORAGE_KEY, "desktop");
    expect(detectPlatform()).toBe("desktop");
  });

  it("?desktop=0 overrides persisted desktop (escape hatch)", () => {
    window.localStorage.setItem(PLATFORM_STORAGE_KEY, "desktop");
    setSearch("?desktop=0");
    expect(detectPlatform()).toBe("web");
  });

  it("initPlatform persists and sets data-platform on documentElement", () => {
    setSearch("?desktop=1");
    expect(initPlatform()).toBe("desktop");
    expect(window.localStorage.getItem(PLATFORM_STORAGE_KEY)).toBe("desktop");
    expect(document.documentElement.dataset.platform).toBe("desktop");
    expect(isDesktop()).toBe(true);
  });

  it("initPlatform keeps web default and does not throw on empty storage", () => {
    expect(initPlatform()).toBe("web");
    expect(document.documentElement.dataset.platform).toBe("web");
    expect(isDesktop()).toBe(false);
  });
});
