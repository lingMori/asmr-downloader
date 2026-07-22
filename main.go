package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"asmroner/internal/app"
)

func main() {
	addr := flag.String("addr", defaultAddr(), "address to bind the HTTP server")
	flag.Parse()

	a, err := app.New(app.Options{Addr: *addr, Version: version})
	if err != nil {
		log.Fatalf("failed to init app: %v", err)
	}

	url, err := a.Start(context.Background())
	if err != nil {
		log.Fatalf("failed to start app: %v", err)
	}
	log.Printf("listening on %s", url)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	if err := a.Stop(context.Background()); err != nil {
		log.Fatalf("server shutdown failed: %v", err)
	}
}

func defaultAddr() string {
	if v := os.Getenv("ASMRO_HTTP_ADDR"); v != "" {
		return v
	}
	return "127.0.0.1:8080"
}
