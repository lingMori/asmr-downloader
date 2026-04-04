package services

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"asmroner/internal/model"
)

type LibraryService struct {
	baseDir string
}

type LibraryListResponse struct {
	Items    []LibraryWorkSummary `json:"items"`
	Total    int                  `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
}

type LibraryWorkSummary struct {
	ID             string `json:"id"`
	MediaID        string `json:"mediaId"`
	Title          string `json:"title"`
	ReleaseDate    string `json:"releaseDate"`
	HasSubtitles   bool   `json:"hasSubtitles"`
	FileCount      int    `json:"fileCount"`
	AudioFileCount int    `json:"audioFileCount"`
	SubtitleCount  int    `json:"subtitleCount"`
	ThumbnailURL   string `json:"thumbnailUrl"`
}

type LibraryWorkDetail struct {
	Summary LibraryWorkSummary `json:"summary"`
	Files   []LibraryFile      `json:"files"`
}

type LibraryFile struct {
	Path string `json:"path"`
	Name string `json:"name"`
	Kind string `json:"kind"`
	URL  string `json:"url"`
}

var libraryFolderPattern = regexp.MustCompile(`^([^-\s]+)-(\d{8})-(sub|nosub)-(.+)$`)
var libraryMediaIDPattern = regexp.MustCompile(`(?i)(RJ|BJ|VJ|RE)\d+`)
var libraryDatePattern = regexp.MustCompile(`\d{8}`)

func NewLibraryService() *LibraryService {
	return &LibraryService{baseDir: model.AppConfig.Downloader.SyncDataFolder}
}

func (s *LibraryService) BaseDir() string {
	return s.baseDir
}

func (s *LibraryService) SetBaseDir(baseDir string) {
	s.baseDir = baseDir
}

func (s *LibraryService) ResolveMediaPath(relPath string) (string, error) {
	if s.baseDir == "" {
		return "", os.ErrNotExist
	}

	cleanPath := filepath.Clean(strings.TrimPrefix(relPath, "/"))
	if cleanPath == "." || cleanPath == "" {
		return "", os.ErrNotExist
	}
	if cleanPath == ".." || strings.HasPrefix(cleanPath, ".."+string(os.PathSeparator)) {
		return "", errors.New("invalid media path")
	}

	absBase, err := filepath.Abs(s.baseDir)
	if err != nil {
		return "", err
	}
	absTarget, err := filepath.Abs(filepath.Join(absBase, cleanPath))
	if err != nil {
		return "", err
	}
	if absTarget != absBase && !strings.HasPrefix(absTarget, absBase+string(os.PathSeparator)) {
		return "", errors.New("invalid media path")
	}
	if _, err := os.Stat(absTarget); err != nil {
		return "", err
	}
	return absTarget, nil
}

func (s *LibraryService) ListWorks(_ context.Context, page, pageSize int, search string) (LibraryListResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 48 {
		pageSize = 24
	}

	entries, err := s.loadEntries(search)
	if err != nil {
		return LibraryListResponse{}, err
	}

	total := len(entries)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	return LibraryListResponse{
		Items:    entries[start:end],
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *LibraryService) GetWorkDetail(_ context.Context, id string) (LibraryWorkDetail, error) {
	entries, err := s.loadEntries("")
	if err != nil {
		return LibraryWorkDetail{}, err
	}

	for _, item := range entries {
		if item.ID != id && item.MediaID != id {
			continue
		}
		files, err := scanLibraryFiles(filepath.Join(s.baseDir, item.ID), item.ID)
		if err != nil {
			return LibraryWorkDetail{}, err
		}
		return LibraryWorkDetail{
			Summary: item,
			Files:   files,
		}, nil
	}

	return LibraryWorkDetail{}, os.ErrNotExist
}

func (s *LibraryService) loadEntries(search string) ([]LibraryWorkSummary, error) {
	if _, err := os.Stat(s.baseDir); os.IsNotExist(err) {
		return []LibraryWorkSummary{}, nil
	}

	dirEntries, err := os.ReadDir(s.baseDir)
	if err != nil {
		return nil, err
	}

	search = strings.ToLower(strings.TrimSpace(search))
	items := make([]LibraryWorkSummary, 0, len(dirEntries))
	for _, entry := range dirEntries {
		if !entry.IsDir() {
			continue
		}
		matches := libraryFolderPattern.FindStringSubmatch(entry.Name())
		summary, err := buildLibrarySummary(filepath.Join(s.baseDir, entry.Name()), entry.Name(), matches)
		if err != nil {
			return nil, err
		}
		if summary.AudioFileCount == 0 && summary.SubtitleCount == 0 && summary.ThumbnailURL == "" {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(summary.Title), search) && !strings.Contains(strings.ToLower(summary.MediaID), search) {
			continue
		}
		items = append(items, summary)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ReleaseDate > items[j].ReleaseDate
	})

	return items, nil
}

func buildLibrarySummary(dirPath string, folderName string, matches []string) (LibraryWorkSummary, error) {
	files, err := scanLibraryFiles(dirPath, folderName)
	if err != nil {
		return LibraryWorkSummary{}, err
	}

	summary := LibraryWorkSummary{
		ID:        folderName,
		Title:     folderName,
		FileCount: len(files),
	}
	if len(matches) == 5 {
		summary.MediaID = matches[1]
		summary.ReleaseDate = matches[2]
		summary.HasSubtitles = matches[3] == "sub"
		summary.Title = matches[4]
	} else {
		if mediaID := libraryMediaIDPattern.FindString(folderName); mediaID != "" {
			summary.MediaID = strings.ToUpper(mediaID)
		} else {
			summary.MediaID = folderName
		}
		summary.ReleaseDate = libraryDatePattern.FindString(folderName)
	}
	for _, file := range files {
		switch file.Kind {
		case "audio":
			summary.AudioFileCount++
		case "subtitle":
			summary.SubtitleCount++
			summary.HasSubtitles = true
		case "image":
			if summary.ThumbnailURL == "" {
				summary.ThumbnailURL = file.URL
			}
		}
	}
	return summary, nil
}

func scanLibraryFiles(dirPath string, folderName string) ([]LibraryFile, error) {
	files := make([]LibraryFile, 0, 32)
	err := filepath.WalkDir(dirPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || path == dirPath {
			return nil
		}

		rel, err := filepath.Rel(dirPath, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		files = append(files, LibraryFile{
			Path: rel,
			Name: d.Name(),
			Kind: detectLibraryFileKind(d.Name()),
			URL:  "/media/" + folderName + "/" + rel,
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(files, func(i, j int) bool {
		return files[i].Path < files[j].Path
	})
	return files, nil
}

func detectLibraryFileKind(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.HasSuffix(lower, ".mp3"), strings.HasSuffix(lower, ".wav"), strings.HasSuffix(lower, ".flac"), strings.HasSuffix(lower, ".m4a"), strings.HasSuffix(lower, ".ogg"):
		return "audio"
	case strings.HasSuffix(lower, ".vtt"), strings.HasSuffix(lower, ".srt"), strings.HasSuffix(lower, ".lrc"):
		return "subtitle"
	case strings.HasSuffix(lower, ".jpg"), strings.HasSuffix(lower, ".jpeg"), strings.HasSuffix(lower, ".png"), strings.HasSuffix(lower, ".webp"):
		return "image"
	default:
		return "other"
	}
}
