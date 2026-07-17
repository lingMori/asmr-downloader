package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"asmroner/internal/database"
	"asmroner/internal/model"
)

func newPlaybackService(t *testing.T) *PlaybackService {
	t.Helper()
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.PlayProgress{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}
	return NewPlaybackService(db)
}

func TestPlaybackSaveUpsertsBySourceID(t *testing.T) {
	svc := newPlaybackService(t)
	ctx := context.Background()

	first := model.PlayProgress{
		SourceID:   "RJ123456",
		WorkTitle:  "demo work",
		CoverURL:   "https://img.example/main.jpg",
		TrackPath:  "disc 1/scene.mp3",
		TrackTitle: "scene.mp3",
		Position:   10,
		Duration:   100,
	}
	if err := svc.Save(ctx, first); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	second := first
	second.Position = 42
	second.TrackTitle = "scene-2.mp3"
	second.TrackPath = "disc 1/scene-2.mp3"
	if err := svc.Save(ctx, second); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	got, err := svc.Get(ctx, "RJ123456")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got == nil {
		t.Fatalf("expected saved progress")
	}
	if got.Position != 42 || got.TrackPath != "disc 1/scene-2.mp3" || got.TrackTitle != "scene-2.mp3" {
		t.Fatalf("expected updated row, got %+v", got)
	}
	if got.WorkTitle != "demo work" || got.Duration != 100 {
		t.Fatalf("expected preserved fields, got %+v", got)
	}

	items, err := svc.Latest(ctx, 10)
	if err != nil {
		t.Fatalf("Latest() error = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("upsert should keep a single row per source_id, got %d", len(items))
	}
}

func TestPlaybackLatestOrdersByUpdatedAtDesc(t *testing.T) {
	svc := newPlaybackService(t)
	ctx := context.Background()
	base := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	older := model.PlayProgress{SourceID: "RJ111111", TrackPath: "a.mp3", Position: 1, UpdatedAt: base.Add(-time.Hour)}
	newer := model.PlayProgress{SourceID: "RJ222222", TrackPath: "b.mp3", Position: 2, UpdatedAt: base}
	middle := model.PlayProgress{SourceID: "RJ333333", TrackPath: "c.mp3", Position: 3, UpdatedAt: base.Add(-30 * time.Minute)}
	for _, progress := range []model.PlayProgress{older, newer, middle} {
		if err := svc.Save(ctx, progress); err != nil {
			t.Fatalf("Save() error = %v", err)
		}
	}

	items, err := svc.Latest(ctx, 3)
	if err != nil {
		t.Fatalf("Latest() error = %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(items))
	}
	if items[0].SourceID != "RJ222222" || items[1].SourceID != "RJ333333" || items[2].SourceID != "RJ111111" {
		t.Fatalf("unexpected order: %+v", items)
	}
}

func TestPlaybackLatestClampsLimit(t *testing.T) {
	svc := newPlaybackService(t)
	ctx := context.Background()
	base := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	for index, sourceID := range []string{"RJ111111", "RJ222222"} {
		progress := model.PlayProgress{
			SourceID:  sourceID,
			TrackPath: "track.mp3",
			Position:  float64(index),
			UpdatedAt: base.Add(time.Duration(index) * time.Minute),
		}
		if err := svc.Save(ctx, progress); err != nil {
			t.Fatalf("Save() error = %v", err)
		}
	}

	items, err := svc.Latest(ctx, 0)
	if err != nil {
		t.Fatalf("Latest() error = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("limit<=0 should fall back to 1, got %d items", len(items))
	}
	if items[0].SourceID != "RJ222222" {
		t.Fatalf("expected most recent item, got %+v", items[0])
	}

	items, err = svc.Latest(ctx, 100)
	if err != nil {
		t.Fatalf("Latest() error = %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected all 2 items within clamped limit, got %d", len(items))
	}
}

func TestPlaybackGetReturnsNilWhenMissing(t *testing.T) {
	svc := newPlaybackService(t)

	got, err := svc.Get(context.Background(), "RJ999999")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for missing source_id, got %+v", got)
	}
}

func TestPlaybackSaveValidatesInput(t *testing.T) {
	svc := newPlaybackService(t)
	ctx := context.Background()

	cases := []model.PlayProgress{
		{SourceID: "", TrackPath: "a.mp3", Position: 1},
		{SourceID: "RJ123456", TrackPath: "", Position: 1},
		{SourceID: "RJ123456", TrackPath: "a.mp3", Position: -1},
	}
	for index, progress := range cases {
		if err := svc.Save(ctx, progress); !errors.Is(err, ErrInvalidPlaybackRequest) {
			t.Fatalf("case %d: expected ErrInvalidPlaybackRequest, got %v", index, err)
		}
	}
}

func TestPlaybackDelete(t *testing.T) {
	svc := newPlaybackService(t)
	ctx := context.Background()

	progress := model.PlayProgress{SourceID: "RJ123456", TrackPath: "a.mp3", Position: 1}
	if err := svc.Save(ctx, progress); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if err := svc.Delete(ctx, "RJ123456"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	got, err := svc.Get(ctx, "RJ123456")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got != nil {
		t.Fatalf("expected progress to be deleted, got %+v", got)
	}
}
