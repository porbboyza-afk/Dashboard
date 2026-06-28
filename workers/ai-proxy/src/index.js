const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

function json(body, status = 200, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
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
    if (request.method !== "POST") return json({ error: { message: "Method not allowed" } }, 405, corsOrigin);
    if (!env.DEEPSEEK_API_KEY) return json({ error: { message: "DEEPSEEK_API_KEY is not configured" } }, 500, corsOrigin);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: { message: "Invalid JSON body" } }, 400, corsOrigin);
    }

    const messages = Array.isArray(payload.messages) ? payload.messages.slice(-14) : [];
    if (!messages.length) return json({ error: { message: "messages[] is required" } }, 400, corsOrigin);

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
    return json(data, upstream.status, corsOrigin);
  }
};
