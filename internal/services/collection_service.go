package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"asmroner/internal/model"
	"asmroner/internal/utils"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrInvalidCollectionRequest = errors.New("invalid collection request")

type CollectionService struct {
	db *gorm.DB
}

type CollectionListResponse struct {
	Items    []model.Collection `json:"items"`
	Total    int                `json:"total"`
	Page     int                `json:"page"`
	PageSize int                `json:"page_size"`
}

func NewCollectionService(db *gorm.DB) *CollectionService {
	return &CollectionService{db: db}
}

// List 分页列出收藏,按收藏时间(created_at)倒序
func (s *CollectionService) List(ctx context.Context, page, pageSize int) (CollectionListResponse, error) {
	if s.db == nil {
		return CollectionListResponse{}, errors.New("collection database is not available")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 48 {
		pageSize = 24
	}

	var total int64
	if err := s.db.WithContext(ctx).Model(&model.Collection{}).Count(&total).Error; err != nil {
		return CollectionListResponse{}, err
	}

	items := make([]model.Collection, 0, pageSize)
	if err := s.db.WithContext(ctx).
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return CollectionListResponse{}, err
	}
	for i := range items {
		normalizeCollectionSlices(&items[i])
	}

	return CollectionListResponse{
		Items:    items,
		Total:    int(total),
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// Add 收藏一个作品(快照全字段),按source_id upsert:
// 已存在则更新快照与updated_at,保留原created_at
func (s *CollectionService) Add(ctx context.Context, collection model.Collection) error {
	if s.db == nil {
		return errors.New("collection database is not available")
	}
	collection.SourceID = strings.ToUpper(strings.TrimSpace(collection.SourceID))
	collection.Title = strings.TrimSpace(collection.Title)
	if !isValidCollectionSourceID(collection.SourceID) || collection.Title == "" {
		return ErrInvalidCollectionRequest
	}
	normalizeCollectionSlices(&collection)
	// 收藏时间由服务端掌管,忽略客户端伪造的created_at/updated_at
	collection.CreatedAt = time.Time{}
	collection.UpdatedAt = time.Time{}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "source_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"title",
			"circle",
			"vas",
			"tags",
			"release",
			"rate",
			"dl_count",
			"duration",
			"has_subtitle",
			"thumbnail_url",
			"main_cover_url",
			"updated_at",
		}),
	}).Create(&collection).Error
}

// Remove 取消收藏
func (s *CollectionService) Remove(ctx context.Context, sourceID string) error {
	if s.db == nil {
		return errors.New("collection database is not available")
	}
	sourceID = strings.ToUpper(strings.TrimSpace(sourceID))
	if !isValidCollectionSourceID(sourceID) {
		return ErrInvalidCollectionRequest
	}
	return s.db.WithContext(ctx).
		Where("source_id = ?", sourceID).
		Delete(&model.Collection{}).Error
}

// Collected 返回给定source_id集合中每个id是否已收藏
func (s *CollectionService) Collected(ctx context.Context, sourceIDs []string) (map[string]bool, error) {
	result := make(map[string]bool, len(sourceIDs))
	if s.db == nil {
		return result, nil
	}
	ids := make([]string, 0, len(sourceIDs))
	seen := make(map[string]struct{}, len(sourceIDs))
	for _, id := range sourceIDs {
		id = strings.ToUpper(strings.TrimSpace(id))
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return result, nil
	}

	collected := make([]string, 0, len(ids))
	if err := s.db.WithContext(ctx).
		Model(&model.Collection{}).
		Where("upper(source_id) IN ?", ids).
		Pluck("source_id", &collected).Error; err != nil {
		return nil, err
	}
	for _, id := range collected {
		result[strings.ToUpper(strings.TrimSpace(id))] = true
	}
	return result, nil
}

func isValidCollectionSourceID(sourceID string) bool {
	if sourceID == "" {
		return false
	}
	valid, _, _, err := utils.IsValidDlsiteID(sourceID)
	return valid && err == nil
}

func normalizeCollectionSlices(collection *model.Collection) {
	if collection.Vas == nil {
		collection.Vas = []string{}
	}
	if collection.Tags == nil {
		collection.Tags = []string{}
	}
}
