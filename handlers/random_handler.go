package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"wge/logger"
)

type RandomResponse struct {
	URL string `json:"url"`
}

func RandomArticleHandler(w http.ResponseWriter, r *http.Request, logger *logger.AsyncLogger) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "en"
	}

	logger.Infof("Fetching random article for language: %s", lang)

	randomURL := getRandomURL(lang)
	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return nil
		},
	}

	req, err := http.NewRequest("GET", randomURL, nil)
	if err != nil {
		logger.Errorf("Failed to create random article request for lang %s: %v", lang, err)
		json.NewEncoder(w).Encode(RandomResponse{
			URL: getFallbackURL(lang),
		})
		return
	}

	req.Header.Set("User-Agent", "WikiGraphExplorer/1.0")

	resp, err := client.Do(req)
	if err != nil {
		logger.Errorf("Failed to fetch random article for lang %s: %v", lang, err)
		json.NewEncoder(w).Encode(RandomResponse{
			URL: getFallbackURL(lang),
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

func getRandomURL(lang string) string {
	if lang == "ru" {
		return "https://ru.wikipedia.org/wiki/%D0%A1%D0%BB%D1%83%D0%B6%D0%B5%D0%B1%D0%BD%D0%B0%D1%8F:%D0%A1%D0%BB%D1%83%D1%87%D0%B0%D0%B9%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0"
	}
	return "https://en.wikipedia.org/wiki/Special:Random"
}

func getFallbackURL(lang string) string {
	if lang == "ru" {
		return "https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0"
	}
	return "https://en.wikipedia.org/wiki/Main_Page"
}
