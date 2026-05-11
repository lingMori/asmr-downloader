package server

import (
	"context"
	"errors"
	"net/url"
	"testing"
)

func TestIsClientCanceledError(t *testing.T) {
	err := &url.Error{
		Op:  "Get",
		URL: "https://media.example/audio.mp3",
		Err: context.Canceled,
	}

	if !isClientCanceledError(err) {
		t.Fatalf("expected wrapped context.Canceled to be treated as client canceled")
	}
	if isClientCanceledError(errors.New("upstream failed")) {
		t.Fatalf("expected non-cancel errors to remain regular stream failures")
	}
}
