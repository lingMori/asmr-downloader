package model

import (
	"encoding/json"
	"testing"
)

func TestSearchResultAcceptsVariableLanguageEditionShapes(t *testing.T) {
	tests := []struct {
		name  string
		value string
	}{
		{name: "array", value: `[]`},
		{name: "object", value: `{"zh-cn":{"workno":"RJ00000001"}}`},
		{name: "null", value: `null`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := `{"works":[{"language_editions":` + tt.value + `,"other_language_editions_in_db":` + tt.value + `}],"pagination":{}}`
			var result SearchResult
			if err := json.Unmarshal([]byte(payload), &result); err != nil {
				t.Fatalf("Unmarshal() error = %v", err)
			}
			if len(result.Works) != 1 {
				t.Fatalf("expected one work, got %d", len(result.Works))
			}
			if string(result.Works[0].LanguageEditions) != tt.value {
				t.Fatalf("language_editions = %s, want %s", result.Works[0].LanguageEditions, tt.value)
			}
			if string(result.Works[0].OtherLanguageEditionsInDb) != tt.value {
				t.Fatalf("other_language_editions_in_db = %s, want %s", result.Works[0].OtherLanguageEditionsInDb, tt.value)
			}
		})
	}
}
