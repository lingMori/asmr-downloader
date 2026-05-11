package model

import (
	"encoding/json"
	"testing"
)

func TestTrackUnmarshalSupportsCamelCaseMediaURLs(t *testing.T) {
	raw := []byte(`{
		"type": "folder",
		"title": "disc",
		"children": [
			{
				"type": "audio",
				"title": "scene.mp3",
				"workTitle": "Demo Work",
				"mediaStreamUrl": "https://media.example/stream.mp3",
				"mediaDownloadUrl": "https://media.example/download.mp3",
				"size": 12345
			}
		]
	}`)

	var track Track
	if err := json.Unmarshal(raw, &track); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}

	if len(track.Children) != 1 {
		t.Fatalf("expected one child, got %d", len(track.Children))
	}
	child := track.Children[0]
	if child.WorkTitle != "Demo Work" {
		t.Fatalf("expected camelCase work title, got %q", child.WorkTitle)
	}
	if child.MediaStreamURL != "https://media.example/stream.mp3" {
		t.Fatalf("expected camelCase stream url, got %q", child.MediaStreamURL)
	}
	if child.MediaDownloadURL != "https://media.example/download.mp3" {
		t.Fatalf("expected camelCase download url, got %q", child.MediaDownloadURL)
	}
	if child.Size != 12345 {
		t.Fatalf("expected size 12345, got %d", child.Size)
	}
}
