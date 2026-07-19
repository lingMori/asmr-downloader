import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * 本地收藏(library work id 列表)。
 * 后端无收藏概念(见总计划 §2),存 localStorage `yoru:favorites`;
 * 同 tab 多实例经 CustomEvent 同步,跨 tab 经 storage 事件同步。
 */

export const FAVORITES_STORAGE_KEY = "yoru:favorites";
const CHANGE_EVENT = "yoru:favorites-changed";

export function loadFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]) {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* 隐私模式等写入失败时仅保留内存态 */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export type Favorites = {
  ids: ReadonlySet<string>;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};

export function useFavorites(): Favorites {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set(loadFavorites()));

  useEffect(() => {
    const sync = () => setIds(new Set(loadFavorites()));
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveFavorites([...next]);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return useMemo(() => ({ ids, toggle, has }), [ids, toggle, has]);
}
