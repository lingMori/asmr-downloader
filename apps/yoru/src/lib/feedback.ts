import { apiClient, type FeedbackType } from "@/lib/api";

export type { FeedbackType };

export type FeedbackSender = (sourceId: string, type: FeedbackType) => Promise<unknown>;

export type FeedbackTracker = {
  /** Mark playback (re)start for a work; emits `start-listen` once per work. */
  start: (sourceId: string) => void;
  /** Report the latest playback position; emits time/ratio milestones. */
  tick: (sourceId: string, position: number, duration: number) => void;
  /** Forget the in-flight position (session switch/close). Sent state persists. */
  stop: () => void;
  /** Milestones already emitted for a work (mainly for tests). */
  sentFor: (sourceId: string) => ReadonlySet<FeedbackType>;
};

const TIME_MILESTONES: ReadonlyArray<{ seconds: number; type: FeedbackType }> = [
  { seconds: 300, type: "listen-5mins" },
  { seconds: 900, type: "listen-15mins" },
  { seconds: 1800, type: "listen-30mins" },
  { seconds: 3600, type: "listen-60mins" },
];

const PLAYED_RATIO_MILESTONE = 0.3;
const PLAYED_RATIO_TYPE: FeedbackType = "listen-30percent";
/** Position deltas larger than this are treated as seeks, not played time. */
const MAX_TICK_GAP_SECONDS = 5;

export function createFeedbackTracker(
  send: FeedbackSender = (sourceId, type) => apiClient.sendFeedback(sourceId, type),
): FeedbackTracker {
  const sentByWork = new Map<string, Set<FeedbackType>>();
  const accumulatedByWork = new Map<string, number>();
  let lastSourceId = "";
  let lastPosition: number | null = null;

  const emit = (sourceId: string, type: FeedbackType) => {
    if (!sourceId) {
      return;
    }
    let sent = sentByWork.get(sourceId);
    if (!sent) {
      sent = new Set();
      sentByWork.set(sourceId, sent);
    }
    if (sent.has(type)) {
      return;
    }
    sent.add(type);
    void Promise.resolve()
      .then(() => send(sourceId, type))
      .catch((error) => {
        console.debug("[ASMRoner Feedback] milestone send failed", {
          sourceId,
          type,
          error,
        });
      });
  };

  return {
    start(sourceId) {
      if (!sourceId) {
        return;
      }
      lastSourceId = sourceId;
      lastPosition = null;
      emit(sourceId, "start-listen");
    },
    tick(sourceId, position, duration) {
      if (!sourceId || !Number.isFinite(position)) {
        return;
      }
      if (lastSourceId === sourceId && lastPosition !== null) {
        const delta = position - lastPosition;
        if (delta > 0 && delta <= MAX_TICK_GAP_SECONDS) {
          const accumulated = (accumulatedByWork.get(sourceId) ?? 0) + delta;
          accumulatedByWork.set(sourceId, accumulated);
          for (const milestone of TIME_MILESTONES) {
            if (accumulated >= milestone.seconds) {
              emit(sourceId, milestone.type);
            }
          }
        }
      }
      lastSourceId = sourceId;
      lastPosition = position;
      if (
        Number.isFinite(duration) &&
        duration > 0 &&
        position >= duration * PLAYED_RATIO_MILESTONE
      ) {
        emit(sourceId, PLAYED_RATIO_TYPE);
      }
    },
    stop() {
      lastSourceId = "";
      lastPosition = null;
    },
    sentFor(sourceId) {
      return new Set(sentByWork.get(sourceId) ?? []);
    },
  };
}

/** App-lifetime tracker shared by the global player dock. */
export const globalFeedbackTracker = createFeedbackTracker();
