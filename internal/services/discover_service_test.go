package services

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"asmroner/internal/model"
)

func TestDiscoverWorkDetailAnnotatesPlayableTracks(t *testing.T) {
	svc := NewDiscoverService(nil, &fakeDiscoverEngine{
		work: model.WorkInfo{
			SourceID: "RJ123456",
			Title:    "demo",
		},
		tracks: []model.Track{
			{
				Type:  "folder",
				Title: "disc 1",
				Children: []model.Track{
					{
						Type:  "audio",
						Title: "scene.mp3",
						Hash:  "123/456",
					},
					{
						Type:  "text",
						Title: "scene.lrc",
						Hash:  "123/457",
					},
				},
			},
			{
				Type:  "image",
				Title: "cover.jpg",
			},
		},
	})

	detail, err := svc.GetWorkDetail(context.Background(), "rj123456")
	if err != nil {
		t.Fatalf("GetWorkDetail() error = %v", err)
	}

	if detail.Tracks[0].ID != "0" {
		t.Fatalf("expected folder id 0, got %q", detail.Tracks[0].ID)
	}
	if detail.Tracks[0].PlayURL != "" {
		t.Fatalf("folder should not be playable, got %q", detail.Tracks[0].PlayURL)
	}

	child := detail.Tracks[0].Children[0]
	if child.ID != "0.0" {
		t.Fatalf("expected child id 0.0, got %q", child.ID)
	}
	if child.PlayURL != "/api/discover/works/RJ123456/tracks/0.0/stream" {
		t.Fatalf("unexpected play url: %q", child.PlayURL)
	}
	if child.MediaStreamURL != "" {
		t.Fatalf("detail response should not expose upstream stream url")
	}
	if child.MediaDownloadURL != "" {
		t.Fatalf("detail response should not expose upstream download url")
	}
	if lrc := detail.Tracks[0].Children[1]; lrc.PlayURL != "" {
		t.Fatalf("lyrics file should not be playable, got %q", lrc.PlayURL)
	}
	if detail.Tracks[1].PlayURL != "" {
		t.Fatalf("non-audio item without a stream url should not be playable")
	}
}

func TestDiscoverOpenTrackStreamUsesValidatedTrackURL(t *testing.T) {
	fake := &fakeDiscoverEngine{
		tracks: []model.Track{
			{
				Type:  "folder",
				Title: "disc 1",
				Children: []model.Track{
					{
						Type:           "audio",
						Title:          "scene.mp3",
						MediaStreamURL: "https://media.example/scene.mp3",
					},
				},
			},
		},
	}
	svc := NewDiscoverService(nil, fake)

	stream, err := svc.OpenTrackStream(context.Background(), "RJ123456", "0.0", "bytes=0-1023")
	if err != nil {
		t.Fatalf("OpenTrackStream() error = %v", err)
	}
	defer stream.Response.Body.Close()

	if fake.streamURL != "https://media.example/scene.mp3" {
		t.Fatalf("expected validated stream url, got %q", fake.streamURL)
	}
	if fake.rangeHeader != "bytes=0-1023" {
		t.Fatalf("expected range header to be forwarded, got %q", fake.rangeHeader)
	}
	if stream.Response.StatusCode != http.StatusPartialContent {
		t.Fatalf("expected partial content response, got %d", stream.Response.StatusCode)
	}
}

func TestDiscoverOpenTrackStreamFallsBackToDownloadURL(t *testing.T) {
	fake := &fakeDiscoverEngine{
		tracks: []model.Track{
			{
				Type:  "folder",
				Title: "disc 1",
				Children: []model.Track{
					{
						Type:             "audio",
						Title:            "scene.mp3",
						MediaDownloadURL: "https://media.example/download-scene.mp3",
					},
				},
			},
		},
	}
	svc := NewDiscoverService(nil, fake)

	stream, err := svc.OpenTrackStream(context.Background(), "RJ123456", "0.0", "")
	if err != nil {
		t.Fatalf("OpenTrackStream() error = %v", err)
	}
	defer stream.Response.Body.Close()

	if fake.streamURL != "https://media.example/download-scene.mp3" {
		t.Fatalf("expected download url fallback, got %q", fake.streamURL)
	}
}

func TestDiscoverOpenTrackStreamFallsBackToHashMediaURL(t *testing.T) {
	fake := &fakeDiscoverEngine{
		tracks: []model.Track{
			{
				Type:  "folder",
				Title: "disc 1",
				Children: []model.Track{
					{
						Type:  "audio",
						Title: "scene.mp3",
						Hash:  "123/456",
					},
				},
			},
		},
	}
	svc := NewDiscoverService(nil, fake)

	stream, err := svc.OpenTrackStream(context.Background(), "RJ123456", "0.0", "")
	if err != nil {
		t.Fatalf("OpenTrackStream() error = %v", err)
	}
	defer stream.Response.Body.Close()

	if fake.streamURL != "https://media.example/123/456" {
		t.Fatalf("expected hash media url fallback, got %q", fake.streamURL)
	}
}

func TestDiscoverOpenTrackStreamRejectsFolders(t *testing.T) {
	svc := NewDiscoverService(nil, &fakeDiscoverEngine{
		tracks: []model.Track{
			{
				Type:  "folder",
				Title: "disc 1",
				Children: []model.Track{
					{
						Type:           "audio",
						Title:          "scene.mp3",
						MediaStreamURL: "https://media.example/scene.mp3",
					},
				},
			},
		},
	})

	_, err := svc.OpenTrackStream(context.Background(), "RJ123456", "0", "")
	if !errors.Is(err, ErrDiscoverTrackNotPlayable) {
		t.Fatalf("expected ErrDiscoverTrackNotPlayable, got %v", err)
	}
}

func TestDiscoverOpenTrackStreamRejectsNonAudioHashTracks(t *testing.T) {
	fake := &fakeDiscoverEngine{
		tracks: []model.Track{
			{
				Type:  "text",
				Title: "scene.lrc",
				Hash:  "123/456",
			},
		},
	}
	svc := NewDiscoverService(nil, fake)

	_, err := svc.OpenTrackStream(context.Background(), "RJ123456", "0", "")
	if !errors.Is(err, ErrDiscoverTrackNotPlayable) {
		t.Fatalf("expected ErrDiscoverTrackNotPlayable, got %v", err)
	}
	if fake.streamURL != "" {
		t.Fatalf("non-audio track should not open upstream stream, got %q", fake.streamURL)
	}
}

type fakeDiscoverEngine struct {
	work        model.WorkInfo
	tracks      []model.Track
	streamURL   string
	rangeHeader string
}

func (f *fakeDiscoverEngine) SearchForCountResult(_ string, _ int) (model.SearchResult, error) {
	return model.SearchResult{}, nil
}

func (f *fakeDiscoverEngine) GetWorkInfo(_ string) (model.WorkInfo, error) {
	return f.work, nil
}

func (f *fakeDiscoverEngine) GetVoiceTracks(_ string) ([]model.Track, error) {
	return f.tracks, nil
}

func (f *fakeDiscoverEngine) BuildTrackMediaURL(hash string) string {
	return "https://media.example/" + strings.TrimPrefix(hash, "/")
}

func (f *fakeDiscoverEngine) OpenTrackStream(_ context.Context, streamURL string, rangeHeader string) (*http.Response, error) {
	f.streamURL = streamURL
	f.rangeHeader = rangeHeader
	return &http.Response{
		StatusCode: http.StatusPartialContent,
		Status:     "206 Partial Content",
		Header: http.Header{
			"Content-Type":   []string{"audio/mpeg"},
			"Content-Range":  []string{"bytes 0-1023/2048"},
			"Accept-Ranges":  []string{"bytes"},
			"Content-Length": []string{"1024"},
		},
		Body: io.NopCloser(strings.NewReader("audio")),
	}, nil
}
