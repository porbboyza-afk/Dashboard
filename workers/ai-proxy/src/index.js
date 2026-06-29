const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const NEWS_SEARCH_URL = "https://news.google.com/rss/search";

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
    if (request.method === "GET") return json({ ok: true, service: "mydash-ai-proxy", search: "google-news-rss" }, 200, corsOrigin);
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
    if (payload.use_search) {
      searchResults = await searchNews(messages);
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
    return json(data, upstream.status, corsOrigin);
  }
};

async function searchNews(messages) {
  const query = latestUserMessage(messages);
  if (!query) return [];
  const url = new URL(NEWS_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "th");
  url.searchParams.set("gl", "TH");
  url.searchParams.set("ceid", "TH:th");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "accept": "application/rss+xml, application/xml, text/xml",
        "user-agent": "MyDashAIProxy/1.0"
      }
    });
    if (!response.ok) return [];
    const xml = await response.text();
    return parseRssItems(xml).slice(0, 8);
  } catch {
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
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
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
