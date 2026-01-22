package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	webview "github.com/webview/webview_go"

	"wge/logger"
)

type ArticleResponse struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Links   []string `json:"links"`
	Error   string   `json:"error,omitempty"`
}

type RandomResponse struct {
	URL string `json:"url"`
}

func parseArticleHandler(w http.ResponseWriter, r *http.Request, logger *logger.AsyncLogger) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	url := r.URL.Query().Get("url")
	if url == "" {
		logger.Warn("Missing URL parameter in parse request")
		json.NewEncoder(w).Encode(ArticleResponse{
			Error: "Missing URL parameter",
		})
		return
	}

	logger.Infof("Parsing article: %s", url)

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		logger.Errorf("Failed to create request for %s: %v", url, err)
		json.NewEncoder(w).Encode(ArticleResponse{
			Error: err.Error(),
		})
		return
	}

	req.Header.Set("User-Agent", "WikiGraphExplorer/1.0")

	startTime := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		logger.Errorf("Failed to fetch article %s: %v", url, err)
		json.NewEncoder(w).Encode(ArticleResponse{
			Error: err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	duration := time.Since(startTime)
	logger.Infof("Article response received - URL: %s, Status: %d, Duration: %v",
		url, resp.StatusCode, duration)

	if resp.StatusCode != 200 {
		logger.Warnf("Non-200 response from %s: %d", url, resp.StatusCode)
		json.NewEncoder(w).Encode(ArticleResponse{
			Error: fmt.Sprintf("HTTP %d", resp.StatusCode),
		})
		return
	}

	htmlBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Errorf("Failed to read response body for %s: %v", url, err)
		json.NewEncoder(w).Encode(ArticleResponse{
			Error: err.Error(),
		})
		return
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(htmlBytes)))
	if err != nil {
		logger.Errorf("Failed to parse HTML for %s: %v", url, err)
		json.NewEncoder(w).Encode(ArticleResponse{
			Error: err.Error(),
		})
		return
	}

	title := ""
	doc.Find("#firstHeading, h1#firstHeading, h1.mw-first-heading").Each(func(i int, s *goquery.Selection) {
		title = strings.TrimSpace(s.Text())
	})

	if title == "" {
		doc.Find("h1").Each(func(i int, s *goquery.Selection) {
			if title == "" {
				title = strings.TrimSpace(s.Text())
			}
		})
	}

	if title == "" {
		title = "Article"
	}

	logger.Infof("Article title extracted - URL: %s, Title: %s", url, title)

	baseDomain := "https://en.wikipedia.org"
	if strings.Contains(url, "ru.wikipedia.org") {
		baseDomain = "https://ru.wikipedia.org"
	}

	var contentSelection *goquery.Selection
	contentSelectors := []string{
		"#mw-content-text",
		".mw-parser-output",
		"#bodyContent",
		".vector-body",
		"#content",
		".mw-body-content",
	}

	for _, selector := range contentSelectors {
		if selection := doc.Find(selector); selection.Length() > 0 {
			contentSelection = selection.First()
			break
		}
	}

	if contentSelection == nil {
		doc.Find("div").Each(func(i int, s *goquery.Selection) {
			if class, _ := s.Attr("class"); strings.Contains(class, "content") || strings.Contains(class, "body") {
				contentSelection = s
				return
			}
		})
	}

	if contentSelection == nil {
		contentSelection = doc.Find("body")
	}

	contentClone := contentSelection.Clone()

	unwantedInContent := []string{
		"#siteNotice", ".site-notice",
		"#mw-navigation", ".mw-navigation",
		"#mw-panel", ".mw-panel",
		".mw-footer", "#footer", "footer",
		".vector-header", ".mw-header",
		".metadata", ".hatnote",
		".toc", "#toc", ".table-of-contents",
		".ambox", ".navigation-box",
		".mw-indicators", ".mw-jump-link",
		".vector-page-toolbar", ".vector-page-tools",
		".vector-feature-zebra-design-disabled",
		".mw-workspace-container", ".mw-page-container",
	}

	for _, selector := range unwantedInContent {
		contentClone.Find(selector).Remove()
	}

	links := []string{}
	contentClone.Find("a[href]").Each(func(i int, s *goquery.Selection) {
		href, exists := s.Attr("href")
		if !exists {
			return
		}

		var fullURL string

		if strings.HasPrefix(href, "/wiki/") {
			fullURL = baseDomain + href
			if !strings.Contains(href, ":") && !strings.Contains(href, "#") {
				links = append(links, fullURL)
			}

			s.SetAttr("href", fullURL)
		} else if strings.HasPrefix(href, "//") {
			fullURL = "https:" + href
			s.SetAttr("href", fullURL)
		} else if strings.HasPrefix(href, "/") && !strings.HasPrefix(href, "//") {
			fullURL = baseDomain + href
			s.SetAttr("href", fullURL)
		}

		s.RemoveAttr("onclick")
		s.RemoveAttr("onmousedown")
		s.RemoveAttr("onmouseup")

		s.SetAttr("draggable", "true")
		s.SetAttr("data-draggable", "true")
	})

	contentClone.Find("img[src]").Each(func(i int, s *goquery.Selection) {
		src, _ := s.Attr("src")
		if strings.HasPrefix(src, "//") {
			s.SetAttr("src", "https:"+src)
		} else if strings.HasPrefix(src, "/") && !strings.HasPrefix(src, "//") {
			s.SetAttr("src", baseDomain+src)
		}
		s.SetAttr("style", "max-width:100%; height:auto;")
	})

	finalHTML, err := contentClone.Html()
	if err != nil {
		logger.Errorf("Failed to get HTML content for %s: %v", url, err)
		json.NewEncoder(w).Encode(ArticleResponse{
			Error: err.Error(),
		})
		return
	}

	finalHTML = strings.TrimSpace(finalHTML)
	if finalHTML == "" || len(finalHTML) < 100 {
		logger.Warnf("Content too short for %s, using fallback", url)

		var paragraphs []string
		doc.Find("body p").Each(func(i int, s *goquery.Selection) {
			if text := strings.TrimSpace(s.Text()); len(text) > 50 {
				paragraphs = append(paragraphs, "<p>"+text+"</p>")
			}
		})

		if len(paragraphs) > 0 {
			finalHTML = strings.Join(paragraphs, "\n")
		} else {
			finalHTML = `<div style="padding:20px;font-family:Arial;">
				<h1>` + title + `</h1>
				<p>Content structure not recognized. Please try another article.</p>
			</div>`
		}
	}

	finalHTML = `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	
</head>
<body>
	<h1>` + title + `</h1>
	` + finalHTML + `
</body>
</html>`

	totalDuration := time.Since(startTime)
	logger.Infof("Article parsed successfully - URL: %s, Title: %s, Links: %d, Total Duration: %v",
		url, title, len(links), totalDuration)

	json.NewEncoder(w).Encode(ArticleResponse{
		Title:   title,
		Content: finalHTML,
		Links:   links,
	})
}

func randomArticleHandler(w http.ResponseWriter, r *http.Request, logger *logger.AsyncLogger) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "en"
	}

	logger.Infof("Fetching random article for language: %s", lang)

	var randomURL string
	if lang == "ru" {
		randomURL = "https://ru.wikipedia.org/wiki/%D0%A1%D0%BB%D1%83%D0%B6%D0%B5%D0%B1%D0%BD%D0%B0%D1%8F:%D0%A1%D0%BB%D1%83%D1%87%D0%B0%D0%B9%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0"
	} else {
		randomURL = "https://en.wikipedia.org/wiki/Special:Random"
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return nil
		},
	}

	req, err := http.NewRequest("GET", randomURL, nil)
	if err != nil {
		logger.Errorf("Failed to create random article request for lang %s: %v", lang, err)

		var fallbackURL string
		if lang == "ru" {
			fallbackURL = "https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0"
		} else {
			fallbackURL = "https://en.wikipedia.org/wiki/Main_Page"
		}
		json.NewEncoder(w).Encode(RandomResponse{
			URL: fallbackURL,
		})
		return
	}

	req.Header.Set("User-Agent", "WikiGraphExplorer/1.0")

	resp, err := client.Do(req)
	if err != nil {
		logger.Errorf("Failed to fetch random article for lang %s: %v", lang, err)

		var fallbackURL string
		if lang == "ru" {
			fallbackURL = "https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0"
		} else {
			fallbackURL = "https://en.wikipedia.org/wiki/Main_Page"
		}
		json.NewEncoder(w).Encode(RandomResponse{
			URL: fallbackURL,
		})
		return
	}
	defer resp.Body.Close()

	logger.Infof("Random article fetched - Lang: %s, URL: %s, Status: %d",
		lang, resp.Request.URL.String(), resp.StatusCode)

	json.NewEncoder(w).Encode(RandomResponse{
		URL: resp.Request.URL.String(),
	})
}

func startServer(port string) {
	var baseDir string
	exePath, err := os.Executable()
	if err == nil {
		baseDir = filepath.Dir(exePath)
	} else {
		baseDir, _ = os.Getwd()
	}

	logsDir := filepath.Join(baseDir, "logs")
	logger, err := logger.NewAsyncLogger(logsDir)
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Stop()

	logger.Info("=== Wiki Graph Explorer Server Starting ===")
	logger.Infof("Port: %s", port)
	logger.Infof("Base directory: %s", baseDir)

	staticDir := filepath.Join(baseDir, "static")
	indexPath := filepath.Join(staticDir, "html", "index.html")

	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		logger.Errorf("Index.html not found at: %s", indexPath)
		log.Fatalf("index.html not found at: %s", indexPath)
	}

	logger.Infof("Static directory: %s", staticDir)
	logger.Infof("Index.html path: %s", indexPath)

	fs := http.FileServer(http.Dir(staticDir))

	http.Handle("/", fs)
	http.HandleFunc("/api/parse", func(w http.ResponseWriter, r *http.Request) {
		parseArticleHandler(w, r, logger)
	})
	http.HandleFunc("/api/random", func(w http.ResponseWriter, r *http.Request) {
		randomArticleHandler(w, r, logger)
	})
	http.HandleFunc("/html/index.html", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, indexPath)
	})

	logger.Info("HTTP server configured, starting...")

	err = http.ListenAndServe(":"+port, nil)
	if err != nil {
		logger.Errorf("HTTP server failed: %v", err)
		log.Fatal(err)
	}
}

func main() {
	port := "8080"

	go startServer(port)
	time.Sleep(1500 * time.Millisecond)

	w := webview.New(true)
	defer w.Destroy()

	w.SetTitle("Wiki Graph Explorer")
	w.SetSize(1400, 700, webview.HintNone)

	fullURL := fmt.Sprintf("http://localhost:%s/html/index.html", port)
	w.Navigate(fullURL)

	w.Run()
}
