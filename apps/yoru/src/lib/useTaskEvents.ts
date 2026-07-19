import { useEffect, useRef } from "react";

// 与 lib/api.ts 的 API_BASE 约定一致:dev 走 vite proxy、生产同源,恒为 /api。
const EVENTS_URL = (import.meta.env.VITE_API_BASE_URL || "/api") + "/events";

type TaskEventListener = (event: MessageEvent) => void;

const listeners = new Set<TaskEventListener>();
let eventSource: EventSource | null = null;

function dispatchTaskEvent(event: Event) {
  const messageEvent = event as MessageEvent;
  for (const listener of Array.from(listeners)) {
    listener(messageEvent);
  }
}

function ensureEventSource() {
  if (eventSource) {
    return;
  }
  eventSource = new EventSource(EVENTS_URL);
  eventSource.addEventListener("task", dispatchTaskEvent);
}

function releaseEventSource() {
  if (listeners.size > 0) {
    return;
  }
  eventSource?.close();
  eventSource = null;
}

export function useTaskEvents(onEvent: (event: MessageEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const listener: TaskEventListener = (event) => onEventRef.current(event);
    listeners.add(listener);
    ensureEventSource();

    return () => {
      listeners.delete(listener);
      releaseEventSource();
    };
  }, []);
}
