package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

type ParseResponse struct {
	Title   string        `json:"title"`
	Content string        `json:"content"`
	Links   []LinkPreview `json:"links"`
}

type LinkPreview struct {
	URL   string `json:"url"`
	Title string `json:"title"`
}

type ArticleData struct {
	Title   string
	Content string
	Links   []string
}

func main() {
	http.HandleFunc("/", handleIndex)
	fs := http.FileServer(http.Dir("./static"))

	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/parse", handleParse)
	http.HandleFunc("/random", handleRandom)

	fmt.Println("The server is running: http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	tmpl, err := template.ParseFiles("templates/index.html")
	if err != nil {
		http.Error(w, "Template parsing error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	tmpl.Execute(w, nil)
}

func handleParse(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	articleURL := q.Get("url")
	if articleURL == "" {
		http.Error(w, "Parameter not specified 'url'", http.StatusBadRequest)
		return
	}

	limitStr := q.Get("limit")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 5
	}

	articleData, err := parseWikiArticle(articleURL)
	if err != nil {
		http.Error(w, "Article parsing error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	links := articleData.Links
	if len(links) > limit {
		links = links[:limit]
	}

	resp := ParseResponse{
		Title:   articleData.Title,
		Content: articleData.Content,
	}

	for _, l := range links {
		resp.Links = append(resp.Links, LinkPreview{
			URL:   l,
			Title: extractTitleFromWikiURL(l),
		})
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(resp)
}

func handleRandom(w http.ResponseWriter, r *http.Request) {
	randomURL := "https://ru.wikipedia.org/wiki/Служебная:Случайная_страница"
	finalURL, err := resolveFinalURL(randomURL)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error (random page): %v", err), http.StatusInternalServerError)
		return
	}
	resp := struct {
		URL string `json:"url"`
	}{URL: finalURL}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(resp)
}

func resolveFinalURL(startURL string) (string, error) {
	resp, err := http.Get(startURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	return resp.Request.URL.String(), nil
}

func parseWikiArticle(articleURL string) (*ArticleData, error) {
	resp, err := http.Get(articleURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(doc.Find("#firstHeading").Text())
	if title == "" {
		title = "Untitled"
	}

	contentSel := doc.Find("div.mw-content-ltr.mw-parser-output")
	if contentSel.Length() == 0 {
		return &ArticleData{
			Title:   title,
			Content: "<p>The main section of the article was not found</p>",
			Links:   []string{},
		}, nil
	}

	notesHeading := contentSel.Find("h2#Примечания").Parent()
	if notesHeading.Length() > 0 {
		notesHeading.NextAll().Remove()
		notesHeading.Remove()
	}

	var links []string
	contentSel.Find("a").Each(func(i int, s *goquery.Selection) {
		href, exists := s.Attr("href")
		if !exists {
			return
		}

		if isWikiLink(href) {
			fullURL := "https://ru.wikipedia.org" + href
			links = append(links, fullURL)
			s.SetAttr("href", fullURL)
		}
	})
	links = unique(links)

	htmlContent, err := contentSel.Html()
	if err != nil {
		return nil, err
	}

	return &ArticleData{
		Title:   title,
		Content: htmlContent,
		Links:   links,
	}, nil
}

func unique(list []string) []string {
	seen := make(map[string]struct{}, len(list))
	var result []string
	for _, v := range list {
		if _, ok := seen[v]; !ok {
			seen[v] = struct{}{}
			result = append(result, v)
		}
	}
	return result
}

func extractTitleFromWikiURL(fullURL string) string {
	u, err := url.Parse(fullURL)
	if err != nil {
		return fullURL
	}
	title := strings.TrimPrefix(u.Path, "/wiki/")
	title = strings.ReplaceAll(title, "_", " ")
	return title
}

func isWikiLink(href string) bool {
	if !strings.HasPrefix(href, "/wiki/") {
		return false
	}
	if strings.Contains(href, ":") {
		return false
	}
	return true
}
