import { getCurrentLang } from './state.js';

const articleCache = new Map();

export function clearCache() {
    articleCache.clear();
}

export async function parseWikiArticle(url) {
    if (articleCache.has(url)) {
        return articleCache.get(url);
    }

    try {
        const resp = await fetch(`/api/parse?url=${encodeURIComponent(url)}`);
        if (!resp.ok) {
            console.log(`HTTP Error: ${resp.status}`);
            const errorResult = {
                title: 'Error',
                content: `<p>Failed to fetch article (HTTP ${resp.status})</p>`,
                links: []
            };
            return errorResult;
        }
        const data = await resp.json();
        if (data.error) {
            console.log(`API Error: ${data.error}`);
            const errorResult = { title: 'Error', content: `<p>${data.error}</p>`, links: [] };
            return errorResult;
        }
        const result = { title: data.title, content: data.content, links: data.links || [] };
        articleCache.set(url, result);
        return result;
    } catch (error) {
        console.log('Parse error:', error.message);
        return { title: 'Error', content: `<p>Failed to load article: ${error.message}</p>`, links: [] };
    }
}

export async function parseWebPage(url) {
    try {
        return {
            title: 'Web Page',
            content: `<iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>`
        };
    } catch (error) {
        console.log('Web page parse error:', error);
        return { title: 'Web Page', content: `<p>Failed to load web page</p>` };
    }
}

export async function getRandomWikiURL() {
    try {
        const langParam = getCurrentLang() === 'ru' ? 'ru' : 'en';
        const resp = await fetch(`/api/random?lang=${langParam}`);
        if (!resp.ok) {
            return langParam === 'ru'
                ? 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0'
                : 'https://en.wikipedia.org/wiki/Main_Page';
        }
        const data = await resp.json();
        return data.url || (langParam === 'ru'
            ? 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0'
            : 'https://en.wikipedia.org/wiki/Main_Page');
    } catch (error) {
        return getCurrentLang() === 'ru'
            ? 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0'
            : 'https://en.wikipedia.org/wiki/Main_Page';
    }
}

export async function searchWikipedia(query) {
    if (!query || query.length < 2) return [];
    const lang = getCurrentLang() === 'ru' ? 'ru' : 'en';
    const response = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?` +
        `origin=*&action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=10`
    );
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    if (!data.query || !data.query.search || data.query.search.length === 0) return [];
    return data.query.search.map(result => ({
        title: result.title,
        description: result.snippet.replace(/<[^>]*>/g, ''),
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(result.title).replace(/%20/g, '_')}`
    }));
}