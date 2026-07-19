package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"asmroner/internal/database"
	"asmroner/internal/model"
)

func newCollectionService(t *testing.T) *CollectionService {
	t.Helper()
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.Collection{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}
	return NewCollectionService(db)
}

func TestCollectionAddUpsertsBySourceID(t *testing.T) {
	svc := newCollectionService(t)
	ctx := context.Background()

	first := model.Collection{
		SourceID:     "rj123456",
		Title:        "demo work",
		Circle:       "demo circle",
		Vas:          []string{"佐倉綾音"},
		Tags:         []string{"癒し", "バイノーラル"},
		Release:      "2024-05-17",
		Rate:         4.5,
		DlCount:      1234,
		Duration:     3600,
		HasSubtitle:  true,
		ThumbnailURL: "https://img.example/sam.jpg",
		MainCoverURL: "https://img.example/main.jpg",
	}
	if err := svc.Add(ctx, first); err != nil {
		t.Fatalf("Add() error = %v", err)
	}

	got, err := svc.List(ctx, 1, 24)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got.Total != 1 || len(got.Items) != 1 {
		t.Fatalf("expected 1 collection, got %+v", got)
	}
	saved := got.Items[0]
	if saved.SourceID != "RJ123456" {
		t.Fatalf("expected source_id uppercased, got %q", saved.SourceID)
	}
	if len(saved.Vas) != 1 || saved.Vas[0] != "佐倉綾音" || len(saved.Tags) != 2 {
		t.Fatalf("expected vas/tags round-tripped, got %+v", saved)
	}
	createdAt := saved.CreatedAt

	second := first
	second.SourceID = "RJ123456"
	second.Title = "demo work (new title)"
	second.Rate = 4.8
	second.Vas = []string{"佐倉綾音", "鬼頭明里"}
	if err := svc.Add(ctx, second); err != nil {
		t.Fatalf("Add() error = %v", err)
	}

	got, err = svc.List(ctx, 1, 24)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got.Total != 1 || len(got.Items) != 1 {
		t.Fatalf("upsert should keep a single row per source_id, got %+v", got)
	}
	updated := got.Items[0]
	if updated.Title != "demo work (new title)" || updated.Rate != 4.8 || len(updated.Vas) != 2 {
		t.Fatalf("expected updated snapshot, got %+v", updated)
	}
	if !updated.CreatedAt.Equal(createdAt) {
		t.Fatalf("expected created_at preserved, got %v want %v", updated.CreatedAt, createdAt)
	}
	if updated.UpdatedAt.Before(updated.CreatedAt) {
		t.Fatalf("expected updated_at >= created_at, got %+v", updated)
	}
}

func TestCollectionListPaginatesAndOrdersByCreatedAtDesc(t *testing.T) {
	svc := newCollectionService(t)
	db := svc.db
	base := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	for index, sourceID := range []string{"RJ111111", "RJ222222", "RJ333333", "RJ444444", "RJ555555"} {
		collection := model.Collection{
			SourceID:  sourceID,
			Title:     "work " + sourceID,
			CreatedAt: base.Add(time.Duration(index) * time.Minute),
		}
		if err := db.Create(&collection).Error; err != nil {
			t.Fatalf("Create() error = %v", err)
		}
	}

	page1, err := svc.List(context.Background(), 1, 2)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if page1.Total != 5 || page1.Page != 1 || page1.PageSize != 2 || len(page1.Items) != 2 {
		t.Fatalf("unexpected page1 response: %+v", page1)
	}
	if page1.Items[0].SourceID != "RJ555555" || page1.Items[1].SourceID != "RJ444444" {
		t.Fatalf("expected newest first, got %+v", page1.Items)
	}

	page3, err := svc.List(context.Background(), 3, 2)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(page3.Items) != 1 || page3.Items[0].SourceID != "RJ111111" {
		t.Fatalf("unexpected page3 response: %+v", page3)
	}
}

func TestCollectionListClampsPageSize(t *testing.T) {
	svc := newCollectionService(t)
	ctx := context.Background()

	collection := model.Collection{SourceID: "RJ123456", Title: "demo"}
	if err := svc.Add(ctx, collection); err != nil {
		t.Fatalf("Add() error = %v", err)
	}

	got, err := svc.List(ctx, 1, 100)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got.PageSize != 24 || len(got.Items) != 1 {
		t.Fatalf("page_size>48 should fall back to 24, got %+v", got)
	}

	got, err = svc.List(ctx, 0, 0)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got.Page != 1 || got.PageSize != 24 {
		t.Fatalf("invalid page/page_size should fall back to defaults, got %+v", got)
	}
}

func TestCollectionListNormalizesNilSlices(t *testing.T) {
	svc := newCollectionService(t)
	db := svc.db

	if err := db.Create(&model.Collection{SourceID: "RJ123456", Title: "no vas/tags"}).Error; err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	got, err := svc.List(context.Background(), 1, 24)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(got.Items) != 1 {
		t.Fatalf("expected 1 item, got %+v", got)
	}
	if got.Items[0].Vas == nil || got.Items[0].Tags == nil {
		t.Fatalf("expected non-nil vas/tags for json output, got %+v", got.Items[0])
	}
}

func TestCollectionAddValidatesInput(t *testing.T) {
	svc := newCollectionService(t)
	ctx := context.Background()

	cases := []model.Collection{
		{SourceID: "", Title: "demo"},
		{SourceID: "XX123456", Title: "demo"},
		{SourceID: "RJ123456", Title: ""},
		{SourceID: "RJ123456", Title: "   "},
	}
	for index, collection := range cases {
		if err := svc.Add(ctx, collection); !errors.Is(err, ErrInvalidCollectionRequest) {
			t.Fatalf("case %d: expected ErrInvalidCollectionRequest, got %v", index, err)
		}
	}
}

func TestCollectionRemove(t *testing.T) {
	svc := newCollectionService(t)
	ctx := context.Background()

	collection := model.Collection{SourceID: "RJ123456", Title: "demo"}
	if err := svc.Add(ctx, collection); err != nil {
		t.Fatalf("Add() error = %v", err)
	}
	if err := svc.Remove(ctx, "rj123456"); err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	got, err := svc.List(ctx, 1, 24)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got.Total != 0 {
		t.Fatalf("expected collection removed, got %+v", got)
	}

	if err := svc.Remove(ctx, "not-an-id"); !errors.Is(err, ErrInvalidCollectionRequest) {
		t.Fatalf("expected ErrInvalidCollectionRequest, got %v", err)
	}
}

func TestCollectionCollected(t *testing.T) {
	svc := newCollectionService(t)
	ctx := context.Background()

	for _, collection := range []model.Collection{
		{SourceID: "RJ111111", Title: "one"},
		{SourceID: "RJ222222", Title: "two"},
	} {
		if err := svc.Add(ctx, collection); err != nil {
			t.Fatalf("Add() error = %v", err)
		}
	}

	got, err := svc.Collected(ctx, []string{"rj111111", "RJ222222", "RJ333333", "", "RJ111111"})
	if err != nil {
		t.Fatalf("Collected() error = %v", err)
	}
	if !got["RJ111111"] || !got["RJ222222"] {
		t.Fatalf("expected RJ111111/RJ222222 collected, got %+v", got)
	}
	if got["RJ333333"] {
		t.Fatalf("expected RJ333333 not collected, got %+v", got)
	}

	got, err = svc.Collected(ctx, nil)
	if err != nil {
		t.Fatalf("Collected() error = %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty map for empty input, got %+v", got)
	}
}
