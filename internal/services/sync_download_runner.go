package services

import (
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"asmroner/internal/database"
	"asmroner/internal/engine"
	"asmroner/internal/model"
	"asmroner/internal/utils"

	"gorm.io/gorm"
)

// SyncDownloadRunner encapsulates sync download/retry logic.
type SyncDownloadRunner struct {
	DB     *gorm.DB
	Engine DownloadOneEngine
}

type DownloadOneEngine interface {
	DownloadOne(id string, storeBaseDir string) error
}

func NewSyncDownloadRunner(db *gorm.DB, eng DownloadOneEngine) *SyncDownloadRunner {
	if db == nil {
		db = database.Database
	}
	if eng == nil {
		eng = engine.NewEngineManager()
	}
	return &SyncDownloadRunner{
		DB:     db,
		Engine: eng,
	}
}

func (r *SyncDownloadRunner) Run(dir string) error {
	if r.DB == nil {
		return errors.New("database not initialized")
	}
	if dir == "" {
		dir = model.AppConfig.Downloader.SyncDataFolder
	}
	downloadLimitSize, err := utils.FileSize2Byte(model.AppConfig.Downloader.SyncWantedSize)
	if err != nil {
		log.Println("❌ 解析SyncWantedSize失败:", err)
		downloadLimitSize = 1024 * 1024 * 1024
	}
	if err := r.cleanPending(); err != nil {
		return err
	}
	batchSize := 1
	batchCount := 1
	for {
		needSync, hasDownSize, err := r.checkNeedSync(downloadLimitSize)
		if err != nil {
			return err
		}
		if !needSync {
			break
		}
		log.Printf("✅ 已下载的数据大小: %d byte, 下载限制: %d byte\n", hasDownSize, downloadLimitSize)
		time.Sleep(3 * time.Second)
		if err := r.runBatch(dir, batchSize, batchCount, downloadLimitSize); err != nil {
			return err
		}
		batchCount++
	}
	return nil
}

func (r *SyncDownloadRunner) runBatch(downDir string, batchSize int, batchCount int, downloadLimitSize int64) error {
	var needSyncCount int64
	result := r.DB.Table("metadata_works").
		Where("id NOT IN (SELECT metadata_work_id FROM work_sync_infos)").
		Count(&needSyncCount)
	if result.Error != nil {
		return result.Error
	}
	if needSyncCount == 0 {
		log.Println("✅ 没有需要同步下载的新作品")
		return nil
	}
	batchCounts := int(math.Ceil(float64(needSyncCount) / float64(batchSize)))
	log.Printf("📥 找到 %d 个需要同步下载的作品,共需要 %d 批次下载", needSyncCount, batchCounts)
	var metadataWorks []model.MetadataWork
	result = r.DB.Table("metadata_works").
		Where("id NOT IN (SELECT metadata_work_id FROM work_sync_infos)").
		Limit(batchSize).
		Find(&metadataWorks)
	if result.Error != nil {
		return result.Error
	}
	if len(metadataWorks) == 0 {
		log.Println("✅ 没有需要同步下载的新作品")
		return nil
	}
	log.Printf("🔨 正在执行第 %d 次批量(%d)下载...\n", batchCount, batchSize)

	var workSyncInfos []model.WorkSyncInfo
	for _, work := range metadataWorks {
		valid, prefix, number, err := utils.IsValidDlsiteID(work.SourceID)
		if err != nil || !valid {
			log.Printf("❌ 无效的作品ID: %s, 跳过...\n", work.SourceID)
			continue
		}
		hasSubtitle := "nosub"
		if work.HasSubtitle {
			hasSubtitle = "sub"
		}
		folderName := fmt.Sprintf(
			"%s%s-%s-%s-%s",
			strings.ToUpper(prefix),
			number,
			strings.ReplaceAll(work.Release, "-", ""),
			hasSubtitle,
			utils.NormalDirPathStr(strings.ReplaceAll(work.Title, "/", "")),
		)
		workSyncInfos = append(workSyncInfos, model.WorkSyncInfo{
			MetadataWorkId: work.ID,
			SourceId:       work.SourceID,
			HasSubtitle:    work.HasSubtitle,
			Status:         "PENDING",
			FilePath:       filepath.Join(downDir, folderName),
			UpdatedAt:      time.Now(),
		})
	}
	if len(workSyncInfos) == 0 {
		return nil
	}
	if err := r.DB.Create(&workSyncInfos).Error; err != nil {
		return err
	}

	downloadChan := make(chan model.WorkSyncInfo, len(workSyncInfos))
	resultChan := make(chan struct {
		SyncInfo model.WorkSyncInfo
		Error    error
		Size     int64
	}, len(workSyncInfos))
	cancelChan := make(chan struct{})
	var wg sync.WaitGroup

	workerCount := batchSize
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(downDir string) {
			defer wg.Done()
			for {
				select {
				case syncInfo, ok := <-downloadChan:
					if !ok {
						return
					}
					log.Printf("🚀 开始下载作品: %s", syncInfo.SourceId)
					downError := r.Engine.DownloadOne(syncInfo.SourceId, downDir)
					if downError != nil {
						log.Printf("❌ 下载作品 %s 失败: %v", syncInfo.SourceId, downError)
						syncInfo.Status = "FAILED"
						syncInfo.FailReason = downError.Error()
						syncInfo.FailedAt = time.Now()
					} else {
						syncInfo.Status = "COMPLETED"
						size, err := utils.GetDirSize(syncInfo.FilePath)
						if err != nil {
							log.Printf("❌ 计算目录大小失败: %v", err)
							syncInfo.DirSize = 0
						} else {
							syncInfo.DirSize = size
						}
					}
					syncInfo.UpdatedAt = time.Now()
					select {
					case <-cancelChan:
						return
					case resultChan <- struct {
						SyncInfo model.WorkSyncInfo
						Error    error
						Size     int64
					}{syncInfo, downError, syncInfo.DirSize}:
					}
				case <-cancelChan:
					return
				}
			}
		}(downDir)
	}

	for _, syncInfo := range workSyncInfos {
		downloadChan <- syncInfo
	}
	close(downloadChan)

	var totalDownloadedSize int64
	var needCancel bool
	doneCount := 0
	for doneCount < len(workSyncInfos) && !needCancel {
		select {
		case result := <-resultChan:
			doneCount++
			r.updateWorkSync(result.SyncInfo)
			if result.SyncInfo.Status == "COMPLETED" {
				totalDownloadedSize += result.Size
			}
			if totalDownloadedSize >= downloadLimitSize {
				close(cancelChan)
				needCancel = true
			}
		}
	}

	go func() {
		wg.Wait()
		close(resultChan)
	}()

	for result := range resultChan {
		if !needCancel {
			doneCount++
		}
		r.updateWorkSync(result.SyncInfo)
		if result.SyncInfo.Status == "COMPLETED" && !needCancel {
			totalDownloadedSize += result.Size
		}
	}
	log.Printf("✅ 单次批量同步下载完成, 下载大小: %d bytes", totalDownloadedSize)
	return nil
}

func (r *SyncDownloadRunner) updateWorkSync(info model.WorkSyncInfo) {
	updates := map[string]interface{}{
		"status":       info.Status,
		"dir_size":     info.DirSize,
		"updated_at":   info.UpdatedAt,
		"fail_reason":  info.FailReason,
		"retry_count":  info.RetryCount,
		"failed_at":    info.FailedAt,
		"has_subtitle": info.HasSubtitle,
	}
	r.DB.Model(&model.WorkSyncInfo{}).
		Where("metadata_work_id = ?", info.MetadataWorkId).
		Updates(updates)
}

func (r *SyncDownloadRunner) cleanPending() error {
	var pending []model.WorkSyncInfo
	tx := r.DB.Table("work_sync_infos").Where("status = ?", "PENDING").Find(&pending)
	if tx.Error != nil {
		return tx.Error
	}
	for _, info := range pending {
		_ = os.RemoveAll(info.FilePath)
	}
	return r.DB.Table("work_sync_infos").Where("status = ?", "PENDING").Delete(&model.WorkSyncInfo{}).Error
}

func (r *SyncDownloadRunner) checkNeedSync(limit int64) (bool, int64, error) {
	var totalSize int64
	result := r.DB.Raw("SELECT COALESCE(SUM(dir_size), 0) as total_size FROM work_sync_infos WHERE status = ?", "COMPLETED").
		Scan(&totalSize)
	if result.Error != nil {
		return false, totalSize, result.Error
	}
	if totalSize >= limit {
		log.Println("✅ 已下载的数据大小已超过配置的设定值, 无需继续下载")
		return false, totalSize, nil
	}
	return true, totalSize, nil
}

func (r *SyncDownloadRunner) RetryFailed() error {
	if r.DB == nil {
		return errors.New("database not initialized")
	}
	var failed []model.WorkSyncInfo
	tx := r.DB.Table("work_sync_infos").Where("status = ?", "FAILED").Find(&failed)
	if tx.Error != nil {
		return tx.Error
	}
	if len(failed) == 0 {
		log.Println("✅ 没有需要重试下载的文件")
		return nil
	}
	for _, info := range failed {
		if err := r.retryOne(info); err != nil {
			log.Printf("❌ 重试下载作品 %s 失败: %v", info.SourceId, err)
		}
	}
	return nil
}

func (r *SyncDownloadRunner) retryOne(info model.WorkSyncInfo) error {
	if err := os.RemoveAll(info.FilePath); err != nil {
		return err
	}
	if err := r.Engine.DownloadOne(info.SourceId, filepath.Dir(info.FilePath)); err != nil {
		return err
	}
	info.Status = "COMPLETED"
	info.FailReason = ""
	info.RetryCount++
	info.FailedAt = time.Now()
	return r.DB.Table("work_sync_infos").Where("id = ?", info.ID).Updates(info).Error
}
