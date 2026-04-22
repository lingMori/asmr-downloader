package events

import (
	"sync"
	"time"

	"asmroner/internal/model"
)

// TaskEvent represents a change in task state for SSE/WebSocket consumers.
type TaskEvent struct {
	TaskID   uint             `json:"task_id"`
	Status   model.TaskStatus `json:"status"`
	Message  string           `json:"message"`
	Progress float64          `json:"progress"`
	Time     time.Time        `json:"time"`
}

// Hub maintains subscribers interested in task events.
type Hub struct {
	mu     sync.RWMutex
	subs   map[chan TaskEvent]struct{}
	closed bool
}

// NewHub constructs a hub instance.
func NewHub() *Hub {
	return &Hub{
		subs: make(map[chan TaskEvent]struct{}),
	}
}

// Subscribe returns a channel that will receive task events.
func (h *Hub) Subscribe() chan TaskEvent {
	h.mu.Lock()
	defer h.mu.Unlock()
	ch := make(chan TaskEvent, 16)
	h.subs[ch] = struct{}{}
	return ch
}

// Unsubscribe removes the channel and closes it.
func (h *Hub) Unsubscribe(ch chan TaskEvent) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.subs[ch]; ok {
		delete(h.subs, ch)
		close(ch)
	}
}

// Publish broadcasts the event to subscribers.
func (h *Hub) Publish(event TaskEvent) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.subs {
		select {
		case ch <- event:
		default:
			// Drop if subscriber is slow.
		}
	}
}
