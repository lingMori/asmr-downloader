import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { FAVORITES_STORAGE_KEY, loadFavorites, useFavorites } from "./favorites";

describe("favorites", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("空存储/脏数据回退为空集", () => {
    expect(loadFavorites()).toEqual([]);
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, "{oops");
    expect(loadFavorites()).toEqual([]);
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ a: 1 }));
    expect(loadFavorites()).toEqual([]);
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(["w1", 2, null, "w2"]));
    expect(loadFavorites()).toEqual(["w1", "w2"]);
  });

  it("toggle 加入/移除并持久化", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.has("w1")).toBe(false);

    act(() => result.current.toggle("w1"));
    expect(result.current.has("w1")).toBe(true);
    expect(loadFavorites()).toEqual(["w1"]);

    act(() => result.current.toggle("w2"));
    expect(result.current.has("w2")).toBe(true);
    expect(loadFavorites()).toEqual(["w1", "w2"]);

    act(() => result.current.toggle("w1"));
    expect(result.current.has("w1")).toBe(false);
    expect(loadFavorites()).toEqual(["w2"]);
  });

  it("从已有存储初始化", () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(["w9"]));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.has("w9")).toBe(true);
  });

  it("同 tab 多实例经 CustomEvent 同步", () => {
    const a = renderHook(() => useFavorites());
    const b = renderHook(() => useFavorites());

    act(() => a.result.current.toggle("w1"));
    expect(b.result.current.has("w1")).toBe(true);

    act(() => b.result.current.toggle("w1"));
    expect(a.result.current.has("w1")).toBe(false);
  });

  it("跨 tab storage 事件同步", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.has("w3")).toBe(false);

    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(["w3"]));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: FAVORITES_STORAGE_KEY }));
    });
    expect(result.current.has("w3")).toBe(true);
  });
});
