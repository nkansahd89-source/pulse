# Pulse — Fundamentals & Bias Engine

A free, client-side dashboard covering all 28 forex pairs plus indices, metals,
commodities, and crypto. No paid API, no login, no backend — it runs entirely
in your browser.

## How it actually works

1. **Calendar**: pulls this week's economic calendar (actual vs. forecast for
   CPI, GDP, jobs, rate decisions) from Forex Factory's public JSON feed.
2. **News**: pulls live headlines from ForexLive, Investing.com, FXStreet, and
   Finance Magnates via free RSS.
3. **Scoring**: each of the 8 currencies gets a 0–100 strength score from
   calendar surprises (weighted by High/Medium/Low impact) plus keyword
   sentiment in the headlines (hawkish/dovish/bullish/bearish words mapped to
   the relevant central bank/country).
4. **Pairs**: every one of the 28 pairs is just the *gap* between its two
   currencies' scores — that's why only 8 numbers drive all 28 reads.
5. **Other markets**: indices, metals, oil/gas, and crypto get their own
   keyword lexicons (risk-on/off, safe-haven, OPEC supply, ETF flows, etc.).
6. **Buy/Sell %**: a simple mapping from the score gap to a percentage split,
   shown as a rule-based *estimate* — not a broker's live order book.

This is a heuristic, not a trained model — it's honest about what it read
(see the **Sources** tab) rather than pretending to certainty it doesn't have.

## Known limitations (read this before you trust it in front of a client)

- **Free CORS proxies can be flaky.** The dashboard tries a direct fetch, then
  three public proxies in sequence. If all four are down or rate-limited at
  the same moment, that source shows "DOWN" on the Sources tab and the
  dashboard falls back to the last cached read (stored in your browser).
- **Forex Factory's calendar feed is rate-limited** (roughly 2 requests per
  5 minutes across all users of that IP/browser combo). The dashboard caches
  for 20 minutes automatically — don't mash Refresh.
- **Keyword sentiment is a blunt instrument.** It counts hits from a fixed
  word list; it doesn't understand negation, sarcasm, or context the way a
  real language model would. Treat scores as a fast fundamentals summary to
  sanity-check your own read, not a signal to trade blindly.
- **No real broker positioning data.** "Buy/Sell %" is derived from the
  fundamentals score, not from actual retail or institutional order flow.

## Deploying to GitHub Pages

Same workflow as your trading journal:

```bash
cd pulse
git init
git add .
git commit -m "Pulse fundamentals dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/pulse.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Source: main branch, / (root)**.
It'll be live at `https://<your-username>.github.io/pulse/` within a minute or two.

## If you ever want real AI-written summaries on top (still free)

The rule-based engine above needs zero setup. If you later want an LLM to
turn the raw scores + headlines into readable prose, both Google Gemini and
Groq have genuinely free API tiers (not just trials). That would be a small
add-on to `script.js` — ask me when you're ready and I'll wire it in.
