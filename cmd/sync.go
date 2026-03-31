package cmd

import (
	"asmroner/internal/database"
	"asmroner/internal/engine"
	"asmroner/internal/model"
	"asmroner/internal/services"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"gorm.io/gorm"
)

// 命令
// 1. xxx sync 执行sync同步元数据
// 2. xxx sync download -d <download_folder> 执行sync元数据并下载文件到指定目录 不指定使用默认folder,下载总数受到配置容量限制
// 3. xxx sync retry -d <download_folder> 重试指定目录下失败的文件 不指定使用默认folder
// 4. xxx sync export -s <failed|success> -f <export_file> 导出指定状态的文件到指定文件,默认导出失败文件
var downloadFolder string
var syncExportFile string
var exportStatus string

// syncCmd 是根 sync 命令
var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "同步元数据并管理文件下载",
	Long: `
sync 命令用于同步资源元数据，并管理文件下载、失败重试及导出操作。

可用子命令：
  download       同步元数据并下载文件
  retry          重试指定目录下下载失败的文件
  export         导出指定状态的文件列表（failed/success）
  report         打印相关统计数据

示例：
  asmroner sync
      仅同步元数据，不下载文件

  asmroner sync download -d ./downloads
      同步元数据并下载文件到指定目录

  asmroner sync retry -d ./downloads
      重试指定目录下失败的下载文件

  asmroner sync export -s failed -f failed_files.csv
      导出失败文件列表到 CSV 文件

  asmroner sync export
      打印相关统计数据
`,
	Run: func(cmd *cobra.Command, args []string) {
		err := doSyncMetadata()
		if err != nil {
			log.Println("❌ 同步元数据失败:", err)
			return
		}
		time.Sleep(2 * time.Second)
		log.Println("✅ 作品元数据同步完成")
	},
}

func doSyncMetadata() error {
	engineManager := engine.NewEngineManager()
	return engineManager.SyncMetadata()
}

// ------------------------- download 子命令 -------------------------
var syncDownloadCmd = &cobra.Command{
	Use:   "download",
	Short: "同步元数据并下载文件",
	Long: `
sync download 子命令用于在同步元数据的同时下载文件。

可用选项：
  -d, --folder <目录路径>
      指定下载文件保存目录，默认当前目录。
      示例：asmroner sync download -d ./downloads

适用场景：
  - 同步并下载新资源
  - 批量更新已有资源
`,
	Run: func(cmd *cobra.Command, args []string) {
		if downloadFolder == "" {
			//use default download folder
			downloadFolder = model.AppConfig.Downloader.SyncDataFolder
		}
		// 同步元数据
		err := doSyncMetadata()
		if err != nil {
			log.Println("❌ 同步元数据失败:", err)
			return
		}
		time.Sleep(2 * time.Second)
		doSyncDownload(downloadFolder)
		log.Println("✅ 文件已成功下载到", downloadFolder)
	},
}

func doSyncDownload(dir string) {
	runner := services.NewSyncDownloadRunner(database.Database, nil)
	if dir == "" {
		dir = model.AppConfig.Downloader.SyncDataFolder
	}
	if err := runner.Run(dir); err != nil {
		log.Println("❌ 同步下载失败:", err)
		return
	}
	log.Println("✅ 文件已成功下载到", dir)
}

// ------------------------- retry-failed 子命令 -------------------------
var retryFailedCmd = &cobra.Command{
	Use:   "retry",
	Short: "重试下载失败的文件",
	Long: `
sync retry 子命令用于重试指定目录下下载失败的文件。

可用选项：
  -d, --folder <目录路径>
      指定失败文件所在目录，如果不指定使用默认下载目录。
      示例：asmroner sync retry -d ./downloads

适用场景：
  - 网络异常或部分文件下载失败后重试
`,
	Run: func(cmd *cobra.Command, args []string) {
		runner := services.NewSyncDownloadRunner(database.Database, nil)
		if err := runner.RetryFailed(); err != nil {
			log.Println("❌ 重试下载失败:", err)
			return
		}
		log.Println("✅ 重试下载完成")
	},
}

// ------------------------- export 子命令 -------------------------
var syncExportCmd = &cobra.Command{
	Use:   "export",
	Short: "导出文件状态列表",
	Long: `
sync export 子命令用于将文件按状态导出为 CSV/JSON 文件，便于管理或统计。

参数说明：
  -s, --status <failed|success>
      指定要导出的文件状态：failed（失败）或 success（成功）
  -f, --file <文件路径>
      指定导出文件路径及文件名，支持 .csv/.json

示例：
  asmroner sync export -s failed -f failed_files.csv
      导出失败文件列表

  asmroner sync export -s success -f success_files.json
      导出成功文件列表

适用场景：
  - 统计成功或失败下载文件
  - 后续处理失败文件
`,
	Run: func(cmd *cobra.Command, args []string) {
		if exportStatus != "failed" && exportStatus != "success" {
			fmt.Println("❌ 状态无效，必须为 'failed' 或 'success'")
			os.Exit(1)
		}
		db := database.Database
		if db == nil {
			log.Println("❌ 数据库连接未初始化")
			return
		}
		if syncExportFile == "" {
			syncExportFile = fmt.Sprintf("%s_%s.csv", exportStatus, time.Now().Format("20060102150405"))
		}
		if strings.HasSuffix(syncExportFile, ".csv") {
			//export csv
			exportCSV(db, exportStatus, syncExportFile)
		} else if strings.HasSuffix(syncExportFile, ".json") {
			//export json
			exportJSON(db, exportStatus, syncExportFile)
		}

		log.Printf("✅ 已导出 %s 记录到 %s\n", exportStatus, syncExportFile)
	},
}

func exportJSON(db *gorm.DB, status string, file string) {
	if status == "success" {
		status = "COMPLETED"
	} else {
		status = "FAILED"
	}
	var syncInfos []model.WorkSyncInfo
	tx := db.Table("work_sync_infos").Where("status = ?", status).Find(&syncInfos)
	if tx.Error != nil {
		log.Println("❌ 查询work_sync_infos失败:", tx.Error)
		return
	}
	if len(syncInfos) == 0 {
		log.Println("✅ 没有需要导出的作品文件记录")
		return
	}
	log.Printf("✅ 有 %d 个作品文件记录需要导出", len(syncInfos))
	// 3. 导出为 JSON 文件
	f, err := os.Create(file)
	if err != nil {
		log.Println("❌ 创建 JSON 文件失败:", err)
		return
	}
	defer f.Close()

	encoder := json.NewEncoder(f)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(syncInfos); err != nil {
		log.Println("❌ 写入 JSON 文件失败:", err)
		return
	}

	log.Printf("✅ 已成功导出 %d 条记录到 %s", len(syncInfos), file)
}

func exportCSV(db *gorm.DB, status string, file string) {
	if status == "success" {
		status = "COMPLETED"
	} else {
		status = "FAILED"
	}
	// 1. 查询所有在work_sync_infos 表中的status 为 status 的作品目录数据
	var syncInfos []model.WorkSyncInfo
	tx := db.Table("work_sync_infos").Where("status = ?", status).Find(&syncInfos)
	if tx.Error != nil {
		log.Println("❌ 查询work_sync_infos失败:", tx.Error)
		return
	}
	if len(syncInfos) == 0 {
		log.Println("✅ 没有需要导出的作品文件记录")
		return
	}
	log.Printf("✅ 有 %d 个作品文件记录需要导出", len(syncInfos))
	// 2. 导出为 CSV 文件
	// 2.1 定义 CSV 列头
	headers := []string{
		"ID", "MetadataWorkId", "SourceId", "DirSize", "Status", "FilePath", "UpdatedAt", "FailReason", "RetryCount", "FailedAt", "HasSubtitle",
	}
	// 2.2 定义 CSV 数据行
	rows := make([][]string, 0, len(syncInfos))
	for _, info := range syncInfos {
		rows = append(rows, []string{
			fmt.Sprintf("%d", info.ID),
			fmt.Sprintf("%d", info.MetadataWorkId),
			info.SourceId,
			fmt.Sprintf("%d", info.DirSize),
			info.Status,
			info.FilePath,
			info.UpdatedAt.Format(time.RFC3339),
			info.FailReason,
			fmt.Sprintf("%d", info.RetryCount),
			info.FailedAt.Format(time.RFC3339),
			fmt.Sprintf("%v", info.HasSubtitle),
		})
	}
	// 2.3 写入 CSV 文件
	f, err := os.Create(file)
	if err != nil {
		log.Println("❌ 创建 CSV 文件失败:", err)
		return
	}
	defer f.Close()

	w := csv.NewWriter(f)
	defer w.Flush()

	// 写入列头
	if err := w.Write(headers); err != nil {
		log.Println("❌ 写入 CSV 列头失败:", err)
		return
	}

	// 写入数据行
	for _, row := range rows {
		if err := w.Write(row); err != nil {
			log.Println("❌ 写入 CSV 数据行失败:", err)
			return
		}
	}

	log.Printf("✅ 已成功导出 %d 条记录到 %s", len(rows), file)
}

var syncReportCmd = &cobra.Command{
	Use:   "report",
	Short: "打印相关统计数据",
	Long: `
sync report 子命令用于打印相关统计数据。

示例：
  asmroner sync report

适用场景：
  - 查看相关统计数据
`,
	Run: func(cmd *cobra.Command, args []string) {
		log.Println("✅ 相关统计数据如下：")
		//打印统计信息 元数据总量  元数据中带字幕的数量 不带字幕的数量,合并成一个sql查询
		db := database.Database
		if db == nil {
			log.Println("❌ 数据库连接未初始化")
			return
		}
		var total, withSubtitle, withoutSubtitle int64
		tx := db.Table("metadata_works").
			Select("COUNT(*) AS total, COUNT(CASE WHEN has_subtitle THEN 1 END) AS withSubtitle, COUNT(CASE WHEN NOT has_subtitle THEN 1 END) AS withoutSubtitle").
			Row()
		if tx.Err() != nil {
			log.Println("❌ 查询metadata_works失败:", tx.Err())
			return
		}
		tx.Scan(&total, &withSubtitle, &withoutSubtitle)
		log.Printf("✅ 元数据总量: %d, 带字幕数量: %d, 不带字幕数量: %d\n", total, withSubtitle, withoutSubtitle)
		//查询同步下载数量,总下载带字幕数量，总下载不带字幕数量,失败数量，等待下载数量
		var syncDownloaded, syncFailed, syncPending, syncWithSubtitle, syncWithoutSubtitle int64
		tx = db.Table("work_sync_infos").
			Joins("JOIN metadata_works ON work_sync_infos.metadata_work_id = metadata_works.id").
			Select("COUNT(CASE WHEN work_sync_infos.status = 'COMPLETED' THEN 1 END) AS syncDownloaded, " +
				"COUNT(CASE WHEN work_sync_infos.status = 'FAILED' THEN 1 END) AS syncFailed, " +
				"COUNT(CASE WHEN work_sync_infos.status = 'PENDING' THEN 1 END) AS syncPending, " +
				"COUNT(CASE WHEN work_sync_infos.status = 'COMPLETED' AND metadata_works.has_subtitle THEN 1 END) AS syncWithSubtitle, " +
				"COUNT(CASE WHEN work_sync_infos.status = 'COMPLETED' AND NOT metadata_works.has_subtitle THEN 1 END) AS syncWithoutSubtitle").
			Row()
		if tx.Err() != nil {
			log.Println("❌ 查询work_sync_infos失败:", tx.Err())
			return
		}
		tx.Scan(&syncDownloaded, &syncFailed, &syncPending, &syncWithSubtitle, &syncWithoutSubtitle)
		log.Printf("✅ 同步下载数量: %d, 带字幕数量: %d, 不带字幕数量: %d,失败数量: %d, 等待下载数量: %d\n", syncDownloaded, syncWithSubtitle, syncWithoutSubtitle, syncFailed, syncPending)

		//计算同步进度
		// 同步进度 = 已下载数量 / 总数量,包含总同步进度，带字幕进度，不带字幕进度
		syncProgress := float64(syncDownloaded) / float64(total) * 100
		syncWithSubtitleProgress := float64(syncWithSubtitle) / float64(withSubtitle) * 100
		syncWithoutSubtitleProgress := float64(syncWithoutSubtitle) / float64(withoutSubtitle) * 100
		log.Printf("✅ 同步进度: %.2f%%, 带字幕进度: %.2f%%, 不带字幕进度: %.2f%%\n", syncProgress, syncWithSubtitleProgress, syncWithoutSubtitleProgress)

	},
}

func init() {
	rootCmd.AddCommand(syncCmd)

	// 添加子命令
	syncCmd.AddCommand(syncDownloadCmd)
	syncCmd.AddCommand(retryFailedCmd)
	syncCmd.AddCommand(syncExportCmd)
	syncCmd.AddCommand(syncReportCmd)

	// 添加 flag
	syncDownloadCmd.Flags().StringVarP(&downloadFolder, "folder", "d", "", "下载文件保存目录(默认配置目录)")
	retryFailedCmd.Flags().StringVarP(&downloadFolder, "folder", "d", "", "下载失败文件所在目录(默认为配置目录)")

	syncExportCmd.Flags().StringVarP(&exportStatus, "status", "s", "", "导出文件状态（failed|success）")
	syncExportCmd.Flags().StringVarP(&syncExportFile, "file", "f", "", "导出文件路径（CSV/JSON）")
	syncExportCmd.MarkFlagRequired("status")
	syncExportCmd.MarkFlagRequired("file")
}
