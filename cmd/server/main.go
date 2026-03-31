package main

import (
	"flag"
	"log"
	"os"

	"asmroner/internal/server"
)

var (
	version   = "dev"
	buildTime = ""
)

func main() {
	addr := flag.String("addr", defaultAddr(), "address to bind the HTTP server")
	flag.Parse()

	server.SetVersion(version)

	srv, err := server.New()
	if err != nil {
		log.Fatalf("failed to init server: %v", err)
	}

	if err := srv.Run(*addr); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}

func defaultAddr() string {
	if v := os.Getenv("ASMRO_HTTP_ADDR"); v != "" {
		return v
	}
	return ":8080"
}
