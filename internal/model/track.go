package model

// 音轨
type Track struct {
	Type             string  `json:"type"`
	Title            string  `json:"title"`
	Children         []Track `json:"children,omitempty"`
	Hash             string  `json:"hash,omitempty"`
	WorkTitle        string  `json:"work_title,omitempty"`
	MediaStreamURL   string  `json:"media_stream_url,omitempty"`
	MediaDownloadURL string  `json:"media_download_url,omitempty"`
}
