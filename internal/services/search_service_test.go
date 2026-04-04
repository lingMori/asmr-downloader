package services

import (
	"context"
	"strings"
	"testing"

	"asmroner/internal/model"
)

type fakeSearchEngine struct {
	result model.SearchResult
}

func (f fakeSearchEngine) SearchForCountResult(_ string, _ int) (model.SearchResult, error) {
	return f.result, nil
}

type captureDownloadEnqueuer struct {
	lastRequest DownloadRequest
}

func (c *captureDownloadEnqueuer) EnqueueDownload(_ context.Context, req DownloadRequest) (uint, error) {
	c.lastRequest = req
	return 42, nil
}

func TestSearchServiceSearchAndExport(t *testing.T) {
	svc := NewSearchService(fakeSearchEngine{
		result: buildSearchResultFixture(),
	}, nil)

	result, err := svc.Search(context.Background(), SearchRequest{
		Query:    "护士@tag:治愈",
		Count:    10,
		Page:     2,
		PageSize: 10,
		Order:    "dl_count",
		Sort:     "asc",
		Subtitle: "1",
	})
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected 1 search item, got %d", len(result.Items))
	}
	if result.Items[0].Circle != "Circle A" {
		t.Fatalf("expected mapped circle name, got %q", result.Items[0].Circle)
	}
	if result.Items[0].MainCoverURL != "https://example.com/cover.jpg" {
		t.Fatalf("expected mapped cover url, got %q", result.Items[0].MainCoverURL)
	}
	if result.Page != 2 || result.PageSize != 10 {
		t.Fatalf("expected paged metadata, got page=%d size=%d", result.Page, result.PageSize)
	}

	content, contentType, filename, err := svc.Export(context.Background(), SearchExportRequest{
		Query:  "护士",
		Count:  10,
		Format: "csv",
	})
	if err != nil {
		t.Fatalf("Export() error = %v", err)
	}
	if contentType != "text/csv; charset=utf-8" {
		t.Fatalf("unexpected content type %q", contentType)
	}
	if !strings.HasSuffix(filename, ".csv") {
		t.Fatalf("expected csv filename, got %q", filename)
	}
	body := string(content)
	if !strings.Contains(body, "Circle A") || !strings.Contains(body, "TagA") {
		t.Fatalf("expected exported csv to contain mapped fields, got %q", body)
	}
}

func TestSearchServiceEnqueueDownload(t *testing.T) {
	downloadSvc := &captureDownloadEnqueuer{}
	searchSvc := NewSearchService(fakeSearchEngine{
		result: buildSearchResultFixture(),
	}, downloadSvc)

	taskID, err := searchSvc.EnqueueDownload(context.Background(), SearchDownloadRequest{
		Query: "护士",
		Count: 10,
		Name:  "Search batch",
	})
	if err != nil {
		t.Fatalf("EnqueueDownload() error = %v", err)
	}
	if taskID != 42 {
		t.Fatalf("expected fake task id 42, got %d", taskID)
	}
	if len(downloadSvc.lastRequest.IDs) != 1 || downloadSvc.lastRequest.IDs[0] != "RJ01000001" {
		t.Fatalf("expected search results to be converted to ids, got %#v", downloadSvc.lastRequest.IDs)
	}
	if downloadSvc.lastRequest.Mode != "batch" {
		t.Fatalf("expected batch mode, got %q", downloadSvc.lastRequest.Mode)
	}
}

func buildSearchResultFixture() model.SearchResult {
	result := model.SearchResult{}
	result.Works = append(result.Works, struct {
		ID              int     "json:\"id\""
		Title           string  "json:\"title\""
		CircleID        int     "json:\"circle_id\""
		Name            string  "json:\"name\""
		Nsfw            bool    "json:\"nsfw\""
		Release         string  "json:\"release\""
		DlCount         int     "json:\"dl_count\""
		Price           int     "json:\"price\""
		ReviewCount     int     "json:\"review_count\""
		RateCount       int     "json:\"rate_count\""
		RateAverage2Dp  float64 "json:\"rate_average_2dp\""
		RateCountDetail []struct {
			ReviewPoint int "json:\"review_point\""
			Count       int "json:\"count\""
			Ratio       int "json:\"ratio\""
		} "json:\"rate_count_detail\""
		Rank        interface{} "json:\"rank\""
		HasSubtitle bool        "json:\"has_subtitle\""
		CreateDate  string      "json:\"create_date\""
		Vas         []struct {
			ID   string "json:\"id\""
			Name string "json:\"name\""
		} "json:\"vas\""
		Tags []struct {
			ID   int "json:\"id\""
			I18N struct {
				EnUs struct {
					Name string "json:\"name\""
				} "json:\"en-us\""
				JaJp struct {
					Name string "json:\"name\""
				} "json:\"ja-jp\""
				ZhCn struct {
					Name    string        "json:\"name\""
					History []interface{} "json:\"history\""
				} "json:\"zh-cn\""
			} "json:\"i18n\""
			Name       string "json:\"name\""
			Upvote     int    "json:\"upvote\""
			Downvote   int    "json:\"downvote\""
			VoteRank   int    "json:\"voteRank\""
			VoteStatus int    "json:\"voteStatus\""
		} "json:\"tags\""
		LanguageEditions          []interface{} "json:\"language_editions\""
		OriginalWorkno            interface{}   "json:\"original_workno\""
		OtherLanguageEditionsInDb []interface{} "json:\"other_language_editions_in_db\""
		TranslationInfo           struct {
			Lang                    interface{}   "json:\"lang\""
			IsChild                 bool          "json:\"is_child\""
			IsParent                bool          "json:\"is_parent\""
			IsOriginal              bool          "json:\"is_original\""
			IsVolunteer             bool          "json:\"is_volunteer\""
			ChildWorknos            []interface{} "json:\"child_worknos\""
			ParentWorkno            interface{}   "json:\"parent_workno\""
			OriginalWorkno          interface{}   "json:\"original_workno\""
			IsTranslationAgree      bool          "json:\"is_translation_agree\""
			TranslationBonusLangs   interface{}   "json:\"translation_bonus_langs\""
			IsTranslationBonusChild bool          "json:\"is_translation_bonus_child\""
		} "json:\"translation_info\""
		WorkAttributes    string      "json:\"work_attributes\""
		AgeCategoryString string      "json:\"age_category_string\""
		Duration          int         "json:\"duration\""
		SourceType        string      "json:\"source_type\""
		SourceID          string      "json:\"source_id\""
		SourceURL         string      "json:\"source_url\""
		UserRating        interface{} "json:\"userRating\""
		PlaylistStatus    struct {
			E3B3E90636A44Fd4B753A5D1Fc50Cb5D bool "json:\"e3b3e906-36a4-4fd4-b753-a5d1fc50cb5d\""
		} "json:\"playlistStatus\""
		Circle struct {
			ID         int    "json:\"id\""
			Name       string "json:\"name\""
			SourceID   string "json:\"source_id\""
			SourceType string "json:\"source_type\""
		} "json:\"circle\""
		SamCoverURL       string "json:\"samCoverUrl\""
		ThumbnailCoverURL string "json:\"thumbnailCoverUrl\""
		MainCoverURL      string "json:\"mainCoverUrl\""
	}{
		Title:             "Work A",
		Release:           "20240101",
		DlCount:           10,
		RateAverage2Dp:    4.8,
		HasSubtitle:       true,
		Duration:          3600,
		SourceID:          "RJ01000001",
		ThumbnailCoverURL: "https://example.com/thumb.jpg",
		MainCoverURL:      "https://example.com/cover.jpg",
	})
	result.Works[0].Circle.Name = "Circle A"
	result.Works[0].Vas = append(result.Works[0].Vas, struct {
		ID   string "json:\"id\""
		Name string "json:\"name\""
	}{
		ID:   "va-1",
		Name: "VA A",
	})
	result.Works[0].Tags = append(result.Works[0].Tags, struct {
		ID   int "json:\"id\""
		I18N struct {
			EnUs struct {
				Name string "json:\"name\""
			} "json:\"en-us\""
			JaJp struct {
				Name string "json:\"name\""
			} "json:\"ja-jp\""
			ZhCn struct {
				Name    string        "json:\"name\""
				History []interface{} "json:\"history\""
			} "json:\"zh-cn\""
		} "json:\"i18n\""
		Name       string "json:\"name\""
		Upvote     int    "json:\"upvote\""
		Downvote   int    "json:\"downvote\""
		VoteRank   int    "json:\"voteRank\""
		VoteStatus int    "json:\"voteStatus\""
	}{
		ID:   1,
		Name: "TagA",
	})
	result.Pagination.TotalCount = 1
	result.Pagination.PageSize = 20
	return result
}
