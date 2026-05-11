package model

import "encoding/json"

// 音轨
type Track struct {
	ID               string  `json:"id,omitempty"`
	Type             string  `json:"type"`
	Title            string  `json:"title"`
	Children         []Track `json:"children,omitempty"`
	Hash             string  `json:"hash,omitempty"`
	WorkTitle        string  `json:"work_title,omitempty"`
	PlayURL          string  `json:"play_url,omitempty"`
	MediaStreamURL   string  `json:"media_stream_url,omitempty"`
	MediaDownloadURL string  `json:"media_download_url,omitempty"`
	Size             int64   `json:"size,omitempty"`
}

func (t *Track) UnmarshalJSON(data []byte) error {
	type trackJSON Track
	raw := struct {
		trackJSON
		WorkTitleCamel        string `json:"workTitle"`
		MediaStreamURLCamel   string `json:"mediaStreamUrl"`
		MediaDownloadURLCamel string `json:"mediaDownloadUrl"`
	}{}

	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	*t = Track(raw.trackJSON)
	if t.WorkTitle == "" {
		t.WorkTitle = raw.WorkTitleCamel
	}
	if t.MediaStreamURL == "" {
		t.MediaStreamURL = raw.MediaStreamURLCamel
	}
	if t.MediaDownloadURL == "" {
		t.MediaDownloadURL = raw.MediaDownloadURLCamel
	}
	return nil
}
