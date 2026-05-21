package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"wge/config"
	"wge/handlers"
	"wge/logger"

	"github.com/abemedia/go-webview"
	_ "github.com/abemedia/go-webview/embedded"
)

//go:generate windres -o resources/app.syso resources/app.rc

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

	http.HandleFunc("/api/parse", func(w http.ResponseWriter, r *http.Request) {
		handlers.ParseArticleHandler(w, r, loggerInst)
	})
	http.HandleFunc("/api/random", func(w http.ResponseWriter, r *http.Request) {
		handlers.RandomArticleHandler(w, r, loggerInst)
	})
	return nil
}

func isAddrInUse(err error) bool {
	return strings.Contains(err.Error(), "address already in use") ||
		strings.Contains(err.Error(), "Only one usage of each socket address")
}

func startServer(cfg *config.Config, ready chan<- int) {
	loggerInst, err := logger.NewAsyncLogger("logs")
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}
	defer loggerInst.Stop()

	if err := registerStaticHandlers(loggerInst); err != nil {
		loggerInst.Errorf("Failed to register static handlers: %v", err)
		log.Fatal(err)
	}

	startPort, err := strconv.Atoi(cfg.Port)
	if err != nil {
		startPort = 8091
	}

	maxAttempts := 100
	for port := startPort; port < startPort+maxAttempts; port++ {
		addr := fmt.Sprintf(":%d", port)
		listener, err := net.Listen("tcp", addr)
		if err != nil {
			if isAddrInUse(err) {
				continue
			}
			loggerInst.Errorf("Failed to listen on port %d: %v", port, err)
			ready <- 0
			log.Fatal(err)
		}
		ready <- port
		loggerInst.Infof("Server started on port %d", port)
		err = http.Serve(listener, nil)
		if err != nil {
			loggerInst.Errorf("HTTP server failed: %v", err)
			log.Fatal(err)
		}
		return
	}

	ready <- 0
	loggerInst.Errorf("Could not find a free port after %d attempts", maxAttempts)
	log.Fatal("No free port available")
}

func main() {
	cfg := config.NewConfig()

	if err := cfg.CreateLogsDir(); err != nil {
		log.Printf("Warning: %v, using current directory", err)
		os.MkdirAll("logs", 0755)
	}

	ready := make(chan int, 1)
	go startServer(cfg, ready)

	actualPort := <-ready
	if actualPort == 0 {
		log.Fatal("Failed to start server")
	}
	time.Sleep(100 * time.Millisecond)

	w := webview.New(true)
	defer w.Destroy()

	w.SetTitle("Wiki Graph Explorer")
	w.SetSize(1400, 700, webview.HintNone)

	fullURL := fmt.Sprintf("http://localhost:%d/html/index.html", actualPort)
	w.Navigate(fullURL)

	w.Run()
}
