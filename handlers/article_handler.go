package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"wge/logger"

	"github.com/PuerkitoBio/goquery"
)

type ArticleResponse struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Links   []string `json:"links"`
	Error   string   `json:"error,omitempty"`
}

func ParseArticleHandler(w http.ResponseWriter, r *http.Request, logger *logger.AsyncLogger) {
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

	title := extractTitle(doc)
	logger.Infof("Article title extracted - URL: %s, Title: %s", url, title)

	baseDomain := getBaseDomain(url)
	contentSelection := findContentSelection(doc)

	if contentSelection == nil {
		contentSelection = doc.Find("body")
	}

	contentClone := contentSelection.Clone()
	cleanContent(contentClone)
	links := processLinks(contentClone, baseDomain)
	processImages(contentClone, baseDomain)

	finalHTML, err := contentClone.Html()
	if err != nil {
		logger.Errorf("Failed to get HTML content for %s: %v", url, err)
		json.NewEncoder(w).Encode(ArticleResponse{
			Error: err.Error(),
		})
		return
	}

	finalHTML = prepareFinalHTML(title, finalHTML, doc, logger, url)

	totalDuration := time.Since(startTime)
	logger.Infof("Article parsed successfully - URL: %s, Title: %s, Links: %d, Total Duration: %v",
		url, title, len(links), totalDuration)

	json.NewEncoder(w).Encode(ArticleResponse{
		Title:   title,
		Content: finalHTML,
		Links:   links,
	})
}

func extractTitle(doc *goquery.Document) string {
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
	return title
}

func getBaseDomain(url string) string {
	if strings.Contains(url, "ru.wikipedia.org") {
		return "https://ru.wikipedia.org"
	}
	return "https://en.wikipedia.org"
}

func findContentSelection(doc *goquery.Document) *goquery.Selection {
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
			return selection.First()
		}
	}

	var contentSelection *goquery.Selection
	doc.Find("div").Each(func(i int, s *goquery.Selection) {
		if contentSelection != nil {
			return
		}
		if class, _ := s.Attr("class"); strings.Contains(class, "content") || strings.Contains(class, "body") {
			contentSelection = s
		}
	})

	return contentSelection
}

func cleanContent(selection *goquery.Selection) {
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
		selection.Find(selector).Remove()
	}
}

func processLinks(selection *goquery.Selection, baseDomain string) []string {
	links := []string{}
	selection.Find("a[href]").Each(func(i int, s *goquery.Selection) {
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
	return links
}

func processImages(selection *goquery.Selection, baseDomain string) {
	selection.Find("img[src]").Each(func(i int, s *goquery.Selection) {
		src, _ := s.Attr("src")
		if strings.HasPrefix(src, "//") {
			s.SetAttr("src", "https:"+src)
		} else if strings.HasPrefix(src, "/") && !strings.HasPrefix(src, "//") {
			s.SetAttr("src", baseDomain+src)
		}
		s.SetAttr("style", "max-width:100%; height:auto;")
	})
}

func prepareFinalHTML(title, html string, doc *goquery.Document, logger *logger.AsyncLogger, url string) string {
	html = strings.TrimSpace(html)
	if html == "" || len(html) < 100 {
		logger.Warnf("Content too short for %s, using fallback", url)

		var paragraphs []string
		doc.Find("body p").Each(func(i int, s *goquery.Selection) {
			if text := strings.TrimSpace(s.Text()); len(text) > 50 {
				paragraphs = append(paragraphs, "<p>"+text+"</p>")
			}
		})

		if len(paragraphs) > 0 {
			html = strings.Join(paragraphs, "\n")
		} else {
			html = fmt.Sprintf(`<div style="padding:20px;font-family:Arial;">
				<h1>%s</h1>
				<p>Content structure not recognized. Please try another article.</p>
			</div>`, title)
		}
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	
</head>
<body>
	<h1>%s</h1>
	%s
</body>
</html>`, title, html)
}
