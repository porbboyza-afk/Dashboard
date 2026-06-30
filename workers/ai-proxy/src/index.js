const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const NEWS_SEARCH_URL = "https://news.google.com/rss/search";
const BING_NEWS_SEARCH_URL = "https://www.bing.com/news/search";
const GDELT_SEARCH_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

function json(body, status = 200, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "vary": "origin"
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "*")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
    const allowsAny = allowedOrigins.includes("*");
    const corsOrigin = allowsAny || allowedOrigins.includes(origin)
      ? (origin || allowedOrigins[0] || "*")
      : (allowedOrigins[0] || "*");

    if (request.method === "OPTIONS") return json({ ok: true }, 200, corsOrigin);
    if (request.method === "GET") return json({ ok: true, service: "mydash-ai-proxy", search: "google-news-rss,bing-news-rss,gdelt" }, 200, corsOrigin);
    if (request.method !== "POST") return json({ error: { message: "Method not allowed" } }, 405, corsOrigin);
    if (!env.DEEPSEEK_API_KEY) return json({ error: { message: "DEEPSEEK_API_KEY is not configured" } }, 500, corsOrigin);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: { message: "Invalid JSON body" } }, 400, corsOrigin);
    }

    let messages = Array.isArray(payload.messages) ? payload.messages.slice(-14) : [];
    if (!messages.length) return json({ error: { message: "messages[] is required" } }, 400, corsOrigin);

    let searchResults = [];
    const searchDebug = [];
    if (payload.use_search) {
      searchResults = await searchNews(messages, searchDebug);
      if (searchResults.length) {
        messages = [
          ...messages.filter(message => message.role !== "system").slice(0, 1),
          {
            role: "system",
            content: buildSearchSystemContext(searchResults)
          },
          ...messages.filter(message => message.role !== "system")
        ].slice(-15);
      }
    }

    const upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: payload.model || "deepseek-chat",
        messages,
        stream: false,
        max_tokens: Math.min(Number(payload.max_tokens || 4096), 4096),
        temperature: Number.isFinite(Number(payload.temperature)) ? Number(payload.temperature) : 0.7
      })
    });

    const data = await upstream.json().catch(() => ({ error: { message: "Invalid upstream response" } }));
    if (searchResults.length && data && typeof data === "object" && !data.error) {
      data.search_results = searchResults;
    }
    if (payload.debug_search && data && typeof data === "object" && !data.error) {
      data.search_debug = searchDebug;
    }
    return json(data, upstream.status, corsOrigin);
  }
};

async function searchNews(messages, debug = []) {
  const query = latestUserMessage(messages);
  if (!query) return [];

  const queries = deriveSearchQueries(query);
  for (const searchQuery of queries) {
    const googleResults = await searchGoogleNews(searchQuery, debug);
    if (googleResults.length) return googleResults;
  }

  for (const searchQuery of queries) {
    const bingResults = await searchBingNews(searchQuery, debug);
    if (bingResults.length) return bingResults;
  }

  for (const searchQuery of queries) {
    const gdeltResults = await searchGdeltNews(searchQuery, debug);
    if (gdeltResults.length) return gdeltResults;
  }

  return [];
}

async function searchGoogleNews(query, debug = []) {
  const url = new URL(NEWS_SEARCH_URL);
  url.searchParams.set("q", query);
  const englishQuery = /^[\x00-\x7F]+$/.test(query);
  url.searchParams.set("hl", englishQuery ? "en-US" : "th");
  url.searchParams.set("gl", englishQuery ? "US" : "TH");
  url.searchParams.set("ceid", englishQuery ? "US:en" : "TH:th");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "accept": "application/rss+xml, application/xml, text/xml",
        "user-agent": "MyDashAIProxy/1.0"
      }
    });
    const xml = await response.text();
    const results = response.ok ? parseRssItems(xml).slice(0, 8) : [];
    debug.push({ provider: "google-news-rss", query, status: response.status, items: results.length, bytes: xml.length });
    if (!response.ok) return [];
    return results;
  } catch (error) {
    debug.push({ provider: "google-news-rss", query, error: error?.message || String(error) });
    return [];
  }
}

async function searchBingNews(query, debug = []) {
  const url = new URL(BING_NEWS_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "rss");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "accept": "application/rss+xml, application/xml, text/xml",
        "user-agent": "MyDashAIProxy/1.0"
      }
    });
    const xml = await response.text();
    const results = response.ok ? parseRssItems(xml).slice(0, 8) : [];
    debug.push({ provider: "bing-news-rss", query, status: response.status, items: results.length, bytes: xml.length });
    if (!response.ok) return [];
    return results;
  } catch (error) {
    debug.push({ provider: "bing-news-rss", query, error: error?.message || String(error) });
    return [];
  }
}

function deriveSearchQueries(query) {
  const cleanQuery = String(query || "").replace(/\s+/g, " ").trim().slice(0, 240);
  const normalized = cleanQuery.toLowerCase();
  const queries = [cleanQuery];
  if (/(ai|เอไอ|ปัญญาประดิษฐ์|เทคโนโลยี|technology|2026)/i.test(normalized)) {
    queries.push("AI technology news 2026");
    queries.push("artificial intelligence technology 2026");
    queries.push("AI startups technology regulation 2026");
  }
  return [...new Set(queries.filter(Boolean))];
}

async function searchGdeltNews(query, debug = []) {
  const url = new URL(GDELT_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "8");
  url.searchParams.set("sort", "HybridRel");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "accept": "application/json",
        "user-agent": "MyDashAIProxy/1.0"
      }
    });
    const text = await response.text();
    if (!response.ok) {
      debug.push({ provider: "gdelt", query, status: response.status, bytes: text.length, items: 0 });
      return [];
    }
    const data = JSON.parse(text);
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    const results = articles.map(article => ({
      title: article.title || "",
      link: article.url || "",
      pubDate: article.seendate || article.datetime || "",
      source: article.domain || article.sourcecountry || "GDELT",
      snippet: [article.title, article.domain, article.language].filter(Boolean).join(" · ")
    })).filter(item => item.title && item.link).slice(0, 8);
    debug.push({ provider: "gdelt", query, status: response.status, items: results.length, bytes: text.length });
    return results;
  } catch (error) {
    debug.push({ provider: "gdelt", query, error: error?.message || String(error) });
    return [];
  }
}

function latestUserMessage(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user" && messages[index]?.content) {
      return String(messages[index].content).slice(0, 240);
    }
  }
  return "";
}

function buildSearchSystemContext(results) {
  const now = new Date().toISOString();
  const lines = results.map((item, index) => {
    return `${index + 1}. ${item.title}\nSource: ${item.source || "Google News"}\nDate: ${item.pubDate || "unknown"}\nURL: ${item.link}\nSnippet: ${item.snippet}`;
  }).join("\n\n");
  return [
    `Current news context fetched at ${now}.`,
    "Use this context for recent/current facts. If the context is insufficient, say so clearly.",
    "Answer in Thai. Cite source names and dates when discussing current events. Do not invent details beyond the sources.",
    "",
    lines
  ].join("\n");
}

function parseRssItems(xml) {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return itemBlocks.map(block => {
    const title = textFromTag(block, "title");
    const rawLink = textFromTag(block, "link");
    const pubDate = textFromTag(block, "pubDate");
    const source = textFromTag(block, "source");
    const description = stripTags(textFromTag(block, "description"));
    return {
      title,
      link: rawLink,
      pubDate,
      source,
      snippet: description.slice(0, 500)
    };
  }).filter(item => item.title && item.link);
}

function textFromTag(block, tag) {
  const match = block.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, "i"));
  return decodeXml(match?.[1] || "").trim();
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
