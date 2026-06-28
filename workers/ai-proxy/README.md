# MyDash AI Proxy

Cloudflare Worker proxy for DeepSeek.

Purpose:

- Keep `DEEPSEEK_API_KEY` out of the browser.
- Let MyDash call a proxy URL instead of `https://api.deepseek.com` directly.
- Limit forwarded chat history to the latest 14 messages.

Deploy outline:

```powershell
cd "C:\Users\pucca\Dashboard-GitHub\workers\ai-proxy"
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```

After deploy, copy the Worker URL into MyDash Settings -> `AI Proxy URL`, then save AI settings.
