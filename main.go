package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"wge/config"
	"wge/handlers"
	"wge/logger"

	webview "github.com/webview/webview_go"
)

//go:embed static/*
var staticFiles embed.FS

func registerStaticHandlers(loggerInst *logger.AsyncLogger) error {
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		loggerInst.Errorf("Failed to create sub filesystem: %v", err)
		return err
	}

	fsHandler := http.FileServer(http.FS(staticFS))

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		requestPath := strings.TrimPrefix(r.URL.Path, "/")
		if requestPath == "" {
			requestPath = "html/index.html"
		}

		if _, err := fs.Stat(staticFS, requestPath); err == nil {
			fsHandler.ServeHTTP(w, r)
			return
		}

		if strings.HasPrefix(requestPath, "html/") ||
			strings.HasSuffix(requestPath, ".html") {
			indexData, err := fs.ReadFile(staticFS, "html/index.html")
			if err != nil {
				http.Error(w, "Not Found", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "text/html")
			w.Write(indexData)
			return
		}

		if strings.HasPrefix(requestPath, "api/") {
			switch path.Base(requestPath) {
			case "parse":
				handlers.ParseArticleHandler(w, r, loggerInst)
			case "random":
				handlers.RandomArticleHandler(w, r, loggerInst)
			default:
				http.Error(w, "Not Found", http.StatusNotFound)
			}
			return
		}

		fsHandler.ServeHTTP(w, r)
	})

	http.Handle("/static/", http.StripPrefix("/static/", fsHandler))
	http.HandleFunc("/api/parse", func(w http.ResponseWriter, r *http.Request) {
		handlers.ParseArticleHandler(w, r, loggerInst)
	})
	http.HandleFunc("/api/random", func(w http.ResponseWriter, r *http.Request) {
		handlers.RandomArticleHandler(w, r, loggerInst)
	})

	loggerInst.Info("Static handlers registered")
	return nil
}

func startServer(cfg *config.Config) {
	loggerInst, err := logger.NewAsyncLogger(cfg.LogsDir)
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}
	defer loggerInst.Stop()

	loggerInst.Info("=== Wiki Graph Explorer Server Starting ===")
	loggerInst.Infof("Configuration: %s", cfg.String())
	loggerInst.Infof("Port: %s", cfg.Port)

	if err := registerStaticHandlers(loggerInst); err != nil {
		loggerInst.Errorf("Failed to register static handlers: %v", err)
		log.Fatal(err)
	}

	loggerInst.Info("HTTP server configured with embedded files, starting...")

	err = http.ListenAndServe(":"+cfg.Port, nil)
	if err != nil {
		loggerInst.Errorf("HTTP server failed: %v", err)
		log.Fatal(err)
	}
}

func main() {
	cfg := config.NewConfig()

	if err := cfg.CreateLogsDir(); err != nil {
		log.Printf("Warning: %v, using current directory", err)
		cfg.LogsDir = "logs"
		os.MkdirAll("logs", 0755)
	}

	go startServer(cfg)
	time.Sleep(1500 * time.Millisecond)

	w := webview.New(true)
	defer w.Destroy()

	w.SetTitle("Wiki Graph Explorer")
	w.SetSize(1400, 700, webview.HintNone)

	fullURL := fmt.Sprintf("http://localhost:%s/html/index.html", cfg.Port)
	w.Navigate(fullURL)

	w.Run()
}
