# MyDash AI Proxy

Cloudflare Worker proxy for DeepSeek.

Purpose:

- Keep `DEEPSEEK_API_KEY` out of the browser.
- Let MyDash call a proxy URL instead of `https://api.deepseek.com` directly.
- Limit forwarded chat history to the latest 14 messages.
- For AI Q&A, optionally fetch current news context from Google News RSS before calling DeepSeek.

Search behavior:

- Frontend sends `use_search: true` for AI Q&A when proxy mode is configured.
- Worker searches Google News RSS using the latest user message.
- Worker injects the fetched headlines/snippets/sources/dates into the model context.
- This does not make the model a full search engine, but it gives it current news context for recent topics.
- Direct browser-to-DeepSeek mode cannot search the web and should not be used for latest-news questions.

Deploy outline:

```powershell
cd "C:\Users\pucca\Dashboard-GitHub\workers\ai-proxy"
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```

After deploy, copy the Worker URL into MyDash Settings -> `AI Proxy URL`, then save AI settings.
