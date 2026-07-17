package services

import (
	"context"
	"errors"
	"strings"

	"asmroner/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrInvalidPlaybackRequest = errors.New("invalid playback request")

type PlaybackService struct {
	db *gorm.DB
}

func NewPlaybackService(db *gorm.DB) *PlaybackService {
	return &PlaybackService{db: db}
}

// Save 按source_id保存播放进度，已存在则更新
func (s *PlaybackService) Save(ctx context.Context, progress model.PlayProgress) error {
	if s.db == nil {
		return errors.New("playback database is not available")
	}
	progress.SourceID = strings.TrimSpace(progress.SourceID)
	progress.TrackPath = strings.TrimSpace(progress.TrackPath)
	if progress.SourceID == "" || progress.TrackPath == "" || progress.Position < 0 {
		return ErrInvalidPlaybackRequest
	}
	progress.ID = 0
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "source_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"work_title",
			"cover_url",
			"track_path",
			"track_title",
			"position",
			"duration",
			"updated_at",
		}),
	}).Create(&progress).Error
}

// Latest 最近播放记录，按updated_at倒序
func (s *PlaybackService) Latest(ctx context.Context, limit int) ([]model.PlayProgress, error) {
	if s.db == nil {
		return nil, errors.New("playback database is not available")
	}
	if limit <= 0 {
		limit = 1
	}
	if limit > 20 {
		limit = 20
	}
	items := make([]model.PlayProgress, 0, limit)
	if err := s.db.WithContext(ctx).
		Order("updated_at DESC").
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// Get 查询单个作品的播放进度，不存在时返回nil
func (s *PlaybackService) Get(ctx context.Context, sourceID string) (*model.PlayProgress, error) {
	if s.db == nil {
		return nil, errors.New("playback database is not available")
	}
	sourceID = strings.TrimSpace(sourceID)
	if sourceID == "" {
		return nil, ErrInvalidPlaybackRequest
	}
	var item model.PlayProgress
	err := s.db.WithContext(ctx).
		Where("source_id = ?", sourceID).
		Take(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// Delete 删除单个作品的播放进度
func (s *PlaybackService) Delete(ctx context.Context, sourceID string) error {
	if s.db == nil {
		return errors.New("playback database is not available")
	}
	sourceID = strings.TrimSpace(sourceID)
	if sourceID == "" {
		return ErrInvalidPlaybackRequest
	}
	return s.db.WithContext(ctx).
		Where("source_id = ?", sourceID).
		Delete(&model.PlayProgress{}).Error
}
