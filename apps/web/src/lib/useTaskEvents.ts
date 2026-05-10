import { useEffect, useRef } from "react";

const EVENTS_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api") +
  "/events";

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
