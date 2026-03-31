import { useEffect, useRef } from "react";

const EVENTS_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api") +
  "/events";

export function useTaskEvents(onEvent: (event: MessageEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource(EVENTS_URL);
    source.addEventListener("task", (event) => onEventRef.current(event));
    return () => {
      source.close();
    };
  }, []);
}
