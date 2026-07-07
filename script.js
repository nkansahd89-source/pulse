/* ============================================================
   PULSE — Fundamentals & Bias Engine
   Entirely free / client-side: no paid API, no login.
   Data: Forex Factory calendar JSON + free forex news RSS feeds,
   read through public CORS proxies. Bias is computed locally
   with a rule-based (calendar-surprise + keyword-sentiment) model.
   ============================================================ */

const CONFIG = {
  CURRENCIES: ['USD','EUR','GBP','JPY','AUD','NZD','CAD','CHF'],

  PAIRS: [
    ['EUR','USD'],['GBP','USD'],['AUD','USD'],['NZD','USD'],
    ['USD','JPY'],['USD','CAD'],['USD','CHF'],
    ['EUR','GBP'],['EUR','AUD'],['EUR','NZD'],['EUR','CAD'],['EUR','CHF'],['EUR','JPY'],
    ['GBP','AUD'],['GBP','NZD'],['GBP','CAD'],['GBP','CHF'],['GBP','JPY'],
    ['AUD','NZD'],['AUD','CAD'],['AUD','CHF'],['AUD','JPY'],
    ['NZD','CAD'],['NZD','CHF'],['NZD','JPY'],
    ['CAD','CHF'],['CAD','JPY'],
    ['CHF','JPY']
  ],

  INDICES: [
    {symbol:'SPX500', name:'S&P 500', region:'US'},
    {symbol:'NAS100', name:'Nasdaq 100', region:'US'},
    {symbol:'US30', name:'Dow Jones 30', region:'US'},
    {symbol:'FTSE100', name:'FTSE 100', region:'UK'},
    {symbol:'DAX40', name:'DAX 40', region:'Germany'},
    {symbol:'CAC40', name:'CAC 40', region:'France'},
    {symbol:'JP225', name:'Nikkei 225', region:'Japan'},
    {symbol:'AUS200', name:'ASX 200', region:'Australia'}
  ],
  METALS: [
    {symbol:'XAUUSD', name:'Gold'},
    {symbol:'XAGUSD', name:'Silver'},
    {symbol:'XPTUSD', name:'Platinum'},
    {symbol:'COPPER', name:'Copper'}
  ],
  COMMODITIES: [
    {symbol:'USOIL', name:'WTI Crude Oil'},
    {symbol:'UKOIL', name:'Brent Crude Oil'},
    {symbol:'NATGAS', name:'Natural Gas'}
  ],
  CRYPTO: [
    {symbol:'BTCUSD', name:'Bitcoin'},
    {symbol:'ETHUSD', name:'Ethereum'},
    {symbol:'SOLUSD', name:'Solana'},
    {symbol:'XRPUSD', name:'XRP'},
    {symbol:'BNBUSD', name:'BNB'}
  ],

  CALENDAR_URL: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',

  RSS_FEEDS: [
    {name:'ForexLive', url:'https://www.forexlive.com/feed/news'},
    {name:'Investing.com', url:'https://www.investing.com/rss/news_1.rss'},
    {name:'FXStreet', url:'https://www.fxstreet.com/rss/news'},
    {name:'Finance Magnates', url:'https://www.financemagnates.com/feed/'}
  ],

  PROXIES: [
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  ],

  CACHE_MINUTES: 20
};

/* ------------------------------------------------------------
   LEXICONS
   ------------------------------------------------------------ */

// Central bank / country keyword -> currency mapping (lowercase)
const CCY_KEYWORDS = {
  USD: ['federal reserve','the fed','fomc','jerome powell','powell','nonfarm','non-farm','payrolls','u.s.','united states','us economy','us cpi','us gdp','washington'],
  EUR: ['ecb','european central bank','christine lagarde','lagarde','eurozone','euro area','eurozone economy','germany','german','france','french','italy','italian'],
  GBP: ['bank of england','boe','andrew bailey','bailey','uk economy','britain','british','united kingdom'],
  JPY: ['bank of japan','boj','kazuo ueda','ueda','japan','japanese','yen','tokyo'],
  AUD: ['reserve bank of australia','rba','michele bullock','bullock','australia','australian','sydney'],
  NZD: ['reserve bank of new zealand','rbnz','new zealand','kiwi','wellington'],
  CAD: ['bank of canada','boc','tiff macklem','macklem','canada','canadian','loonie'],
  CHF: ['swiss national bank','snb','switzerland','swiss','franc','geneva','zurich']
};

const HAWKISH_BULLISH_WORDS = [
  'hawkish','rate hike','hikes rates','raises rates','raised rates','tightening','tightens policy',
  'inflation surges','inflation jumps','beats expectations','beat forecasts','stronger than expected',
  'robust growth','strong jobs report','unemployment falls','economy expands','record high',
  'rallies','surges','strengthens','outperforms','upgrade','upgraded forecast','resilient economy'
];
const DOVISH_BEARISH_WORDS = [
  'dovish','rate cut','cuts rates','cut rates','lowers rates','easing','eases policy',
  'misses expectations','miss forecasts','weaker than expected','disappoints',
  'recession','recession fears','contraction','contracts','slowdown','slows sharply',
  'unemployment rises','jobless claims rise','falls sharply','plunges','tumbles','weakens',
  'downgrade','downgraded forecast','fragile economy','stagnation'
];

// Asset-specific keyword lexicons (for indices / metals / commodities / crypto)
const ASSET_KEYWORDS = {
  metals: {
    match: ['gold','silver','platinum','bullion','precious metal','xau','safe haven','safe-haven'],
    bullish: ['safe haven demand','flight to safety','real yields fall','gold rallies','gold climbs','gold jumps','dollar weakens','inflation hedge demand'],
    bearish: ['gold falls','gold slides','gold tumbles','real yields rise','dollar strengthens','risk appetite returns','profit-taking']
  },
  oil: {
    match: ['crude','oil price','opec','wti','brent','barrel','natural gas','energy market'],
    bullish: ['opec cuts','supply cut','output cut','inventories fall','demand outlook improves','geopolitical risk premium','tensions escalate'],
    bearish: ['opec raises output','supply glut','inventories rise','demand outlook weakens','oversupply','production increase']
  },
  indices: {
    match: ['stocks','equities','wall street','s&p 500','nasdaq','dow jones','ftse','dax','nikkei','shares'],
    bullish: ['stocks rally','shares jump','markets rise','risk-on','earnings beat','record close','stocks climb','investors cheer'],
    bearish: ['stocks fall','shares tumble','markets slide','risk-off','earnings miss','sell-off','stocks plunge','investors flee']
  },
  crypto: {
    match: ['bitcoin','ethereum','crypto','digital asset','blockchain','btc','eth','token'],
    bullish: ['etf inflow','institutional adoption','rallies','surges','breaks resistance','bullish momentum','accumulation'],
    bearish: ['crackdown','regulatory action','hack','exploit','sell-off','breaks support','liquidations','bearish momentum']
  }
};

// Event-name pattern -> direction if actual beats forecast (+1 = bullish for that currency, -1 = bearish)
const EVENT_DIRECTION_RULES = [
  {pattern:/unemployment rate/i, direction:-1},
  {pattern:/unemployment claims|jobless claims|initial claims/i, direction:-1},
  {pattern:/non-?farm|nfp|employment change|payrolls/i, direction:1},
  {pattern:/gdp/i, direction:1},
  {pattern:/cpi|inflation/i, direction:1},
  {pattern:/retail sales/i, direction:1},
  {pattern:/pmi|purchasing managers/i, direction:1},
  {pattern:/industrial production/i, direction:1},
  {pattern:/trade balance/i, direction:1},
  {pattern:/consumer confidence|consumer sentiment/i, direction:1},
  {pattern:/business confidence/i, direction:1},
  {pattern:/building permits|housing starts/i, direction:1},
  {pattern:/durable goods/i, direction:1},
  {pattern:/factory orders/i, direction:1},
  {pattern:/average earnings|wage/i, direction:1},
  {pattern:/interest rate decision|official cash rate|federal funds rate/i, direction:1}
];

function classifyEventDirection(title){
  if (!title) return 0;
  for (const rule of EVENT_DIRECTION_RULES){
    if (rule.pattern.test(title)) return rule.direction;
  }
  return 0;
}

/* ------------------------------------------------------------
   FETCH LAYER — direct first, then a chain of free CORS proxies
   ------------------------------------------------------------ */

async function fetchWithFallback(url, timeoutMs = 9000){
  const attempts = [() => fetch(url), ...CONFIG.PROXIES.map(p => () => fetch(p(url)))];
  for (const attempt of attempts){
    try{
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await attempt();
      clearTimeout(timer);
      if (res && res.ok) return await res.text();
    } catch(e){ /* try next */ }
  }
  throw new Error('unreachable: ' + url);
}

async function fetchCalendar(){
  const raw = await fetchWithFallback(CONFIG.CALENDAR_URL);
  const data = JSON.parse(raw);
  return data.map(e => ({
    title: e.title || e.event || '',
    country: e.country || e.currency || '',
    date: e.date,
    impact: e.impact || 'Low',
    forecast: e.forecast,
    previous: e.previous,
    actual: e.actual
  }));
}

function parseRSS(xmlText, sourceName){
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) return [];
  const items = [...doc.querySelectorAll('item')];
  return items.slice(0, 25).map(item => ({
    title: item.querySelector('title')?.textContent?.trim() || '',
    description: (item.querySelector('description')?.textContent || '').replace(/<[^>]+>/g,'').trim(),
    link: item.querySelector('link')?.textContent?.trim() || '',
    pubDate: item.querySelector('pubDate')?.textContent?.trim() || '',
    source: sourceName
  }));
}

async function fetchAllNews(onSourceResult){
  const results = await Promise.allSettled(
    CONFIG.RSS_FEEDS.map(async feed => {
      const xml = await fetchWithFallback(feed.url);
      const items = parseRSS(xml, feed.name);
      onSourceResult && onSourceResult(feed.name, true, items.length);
      return items;
    })
  );
  const all = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') all.push(...r.value);
    else onSourceResult && onSourceResult(CONFIG.RSS_FEEDS[i].name, false, 0);
  });
  return all;
}

/* ------------------------------------------------------------
   SCORING ENGINE
   ------------------------------------------------------------ */

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function scoreCalendar(events){
  const acc = {};
  CONFIG.CURRENCIES.forEach(c => acc[c] = {sum:0, weight:0});
  const readEvents = []; // for "why" explanations + calendar tab

  events.forEach(e => {
    const ccy = (e.country || '').toUpperCase();
    readEvents.push(e);
    if (!CONFIG.CURRENCIES.includes(ccy)) return;
    const dir = classifyEventDirection(e.title);
    if (dir === 0) return;
    const actual = parseFloat(String(e.actual).replace(/[^\d.\-]/g,''));
    const forecast = parseFloat(String(e.forecast).replace(/[^\d.\-]/g,''));
    if (isNaN(actual) || isNaN(forecast)) return;
    const surprise = actual - forecast;
    if (surprise === 0) return;
    const impactWeight = e.impact === 'High' ? 3 : e.impact === 'Medium' ? 2 : 1;
    const sign = Math.sign(surprise) * dir;
    acc[ccy].sum += sign * impactWeight;
    acc[ccy].weight += impactWeight;
  });

  return {scores: acc, events: readEvents};
}

function scoreNews(headlines){
  const acc = {};
  CONFIG.CURRENCIES.forEach(c => acc[c] = {sum:0, weight:0});
  const assetAcc = {metals:{sum:0,weight:0}, oil:{sum:0,weight:0}, indices:{sum:0,weight:0}, crypto:{sum:0,weight:0}};

  headlines.forEach(h => {
    const text = (h.title + ' ' + (h.description || '')).toLowerCase();
    let sentiment = 0;
    HAWKISH_BULLISH_WORDS.forEach(w => { if (text.includes(w)) sentiment += 1; });
    DOVISH_BEARISH_WORDS.forEach(w => { if (text.includes(w)) sentiment -= 1; });

    if (sentiment !== 0){
      CONFIG.CURRENCIES.forEach(ccy => {
        if (CCY_KEYWORDS[ccy].some(k => text.includes(k))){
          acc[ccy].sum += sentiment;
          acc[ccy].weight += 1;
        }
      });
    }

    Object.keys(ASSET_KEYWORDS).forEach(key => {
      const lex = ASSET_KEYWORDS[key];
      if (!lex.match.some(k => text.includes(k))) return;
      let s = 0;
      lex.bullish.forEach(w => { if (text.includes(w)) s += 1; });
      lex.bearish.forEach(w => { if (text.includes(w)) s -= 1; });
      if (s !== 0){ assetAcc[key].sum += s; assetAcc[key].weight += 1; }
    });
  });

  return {scores: acc, assetScores: assetAcc};
}

function combineStrength(calScores, newsScores){
  const strength = {};
  CONFIG.CURRENCIES.forEach(ccy => {
    const cal = calScores[ccy];
    const news = newsScores[ccy];
    const calAvg = cal.weight ? cal.sum / cal.weight : 0;
    const newsAvg = news.weight ? news.sum / news.weight : 0;
    const hasCal = cal.weight > 0, hasNews = news.weight > 0;
    let combined = 0;
    if (hasCal && hasNews) combined = calAvg * 0.7 + newsAvg * 0.3;
    else if (hasCal) combined = calAvg;
    else if (hasNews) combined = newsAvg;
    strength[ccy] = Math.round(clamp(50 + combined * 15, 5, 95));
  });
  return strength;
}

function assetStrength(assetScores, key){
  const a = assetScores[key];
  const avg = a.weight ? a.sum / a.weight : 0;
  return Math.round(clamp(50 + avg * 15, 5, 95));
}

function biasLabel(diff){
  if (diff > 15) return {label:'Strong Buy', cls:'strong-buy'};
  if (diff > 5) return {label:'Buy', cls:'buy'};
  if (diff >= -5) return {label:'Neutral', cls:'neutral'};
  if (diff >= -15) return {label:'Sell', cls:'sell'};
  return {label:'Strong Sell', cls:'strong-sell'};
}

function diffToBuyPct(diff){
  return Math.round(clamp(50 + diff * 1.4, 5, 95));
}

function computePairBias(strength){
  return CONFIG.PAIRS.map(([base, quote]) => {
    const diff = strength[base] - strength[quote];
    const buyPct = diffToBuyPct(diff);
    const bias = biasLabel(diff);
    return {
      symbol: base + quote, base, quote, diff,
      buyPct, sellPct: 100 - buyPct, bias
    };
  });
}

function whyText(strength, base, quote){
  const stronger = strength[base] >= strength[quote] ? base : quote;
  const weaker = stronger === base ? quote : base;
  return `${stronger} reading firmer (${strength[stronger]}) vs ${weaker} (${strength[weaker]}) on calendar + wire`;
}

/* ------------------------------------------------------------
   APP STATE + CACHE
   ------------------------------------------------------------ */

const state = {
  strength: {},          // currency -> 0-100
  pairs: [],             // computed pair bias list
  assets: {metals:0, oil:0, indices:0, crypto:0},
  news: [],
  calendarEvents: [],
  sourceHealth: [],      // [{name, ok, count}]
  lastUpdated: null
};

const CACHE_KEY = 'pulse_cache_v1';

function saveCache(){
  try{
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      news: state.news, calendarEvents: state.calendarEvents,
      sourceHealth: state.sourceHealth, lastUpdated: state.lastUpdated
    }));
  } catch(e){ /* storage full or unavailable, ignore */ }
}

function loadCache(){
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e){ return null; }
}

function isCacheFresh(cache){
  if (!cache || !cache.lastUpdated) return false;
  return (Date.now() - cache.lastUpdated) < CONFIG.CACHE_MINUTES * 60 * 1000;
}

function recompute(){
  const cal = scoreCalendar(state.calendarEvents);
  const news = scoreNews(state.news);
  state.strength = combineStrength(cal.scores, news.scores);
  state.pairs = computePairBias(state.strength);
  state.assets = {
    metals: assetStrength(news.assetScores, 'metals'),
    oil: assetStrength(news.assetScores, 'oil'),
    indices: assetStrength(news.assetScores, 'indices'),
    crypto: assetStrength(news.assetScores, 'crypto')
  };
}

async function loadData(forceFresh){
  const cache = loadCache();
  if (!forceFresh && isCacheFresh(cache)){
    state.news = cache.news; state.calendarEvents = cache.calendarEvents;
    state.sourceHealth = cache.sourceHealth; state.lastUpdated = cache.lastUpdated;
    recompute();
    renderAll();
    setStatus('cache');
    return;
  }

  setStatus('loading');
  state.sourceHealth = [];

  const [calResult, news] = await Promise.all([
    fetchCalendar().then(evts => { state.sourceHealth.push({name:'Forex Factory calendar', ok:true, count:evts.length}); return evts; })
      .catch(() => { state.sourceHealth.push({name:'Forex Factory calendar', ok:false, count:0}); return (cache && cache.calendarEvents) || []; }),
    fetchAllNews((name, ok, count) => state.sourceHealth.push({name, ok, count}))
      .catch(() => (cache && cache.news) || [])
  ]);

  state.calendarEvents = calResult;
  state.news = (news && news.length) ? news : ((cache && cache.news) || []);
  state.lastUpdated = Date.now();

  recompute();
  saveCache();
  renderAll();

  const anyOk = state.sourceHealth.some(s => s.ok);
  const allOk = state.sourceHealth.every(s => s.ok);
  setStatus(allOk ? 'live' : anyOk ? 'partial' : 'down');
}

function setStatus(kind){
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.className = 'status-dot';
  if (kind === 'loading'){ text.textContent = 'fetching live data…'; }
  else if (kind === 'live'){ dot.classList.add('is-live'); text.textContent = 'live · ' + new Date(state.lastUpdated).toLocaleTimeString(); }
  else if (kind === 'partial'){ dot.classList.add('is-partial'); text.textContent = 'partial · some sources down'; }
  else if (kind === 'down'){ dot.classList.add('is-down'); text.textContent = 'sources unreachable · showing cache'; }
  else if (kind === 'cache'){ dot.classList.add('is-live'); text.textContent = 'cached · ' + new Date(state.lastUpdated).toLocaleTimeString(); }
}

/* ------------------------------------------------------------
   RENDERING
   ------------------------------------------------------------ */

function renderAll(){
  renderStrengthMeter();
  renderTopMovers();
  renderOverviewWire();
  renderPairTable();
  renderAssetGroups();
  renderWireFull();
  renderCalendarTable();
  renderSourceHealth();
}

function renderStrengthMeter(){
  const el = document.getElementById('strengthMeter');
  const ranked = [...CONFIG.CURRENCIES].sort((a,b) => state.strength[b] - state.strength[a]);
  el.innerHTML = ranked.map(ccy => {
    const score = state.strength[ccy] ?? 50;
    const isBull = score >= 50;
    const pct = Math.abs(score - 50); // 0-45ish
    const widthPct = (pct / 50) * 50; // half-track max
    const left = isBull ? '50%' : `${50 - widthPct}%`;
    const width = `${widthPct}%`;
    return `
      <div class="meter-row">
        <span class="meter-ccy">${ccy}</span>
        <div class="meter-track">
          <div class="meter-mid"></div>
          <div class="meter-fill ${isBull ? 'bull' : 'bear'}" style="left:${left}; width:${width};"></div>
        </div>
        <span class="meter-score mono">${score}</span>
      </div>`;
  }).join('');
}

function renderTopMovers(){
  const el = document.getElementById('topMovers');
  const sorted = [...state.pairs].sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 6);
  if (!sorted.length){ el.innerHTML = '<p class="empty-note">No strong reads yet — refresh once data loads.</p>'; return; }
  el.innerHTML = sorted.map(p => `
    <div class="mover-row">
      <div>
        <span class="mover-symbol">${p.base}/${p.quote}</span>
        <div class="mover-reason">${whyText(state.strength, p.base, p.quote)}</div>
      </div>
      <span class="badge ${p.bias.cls}">${p.bias.label}</span>
    </div>`).join('');
}

function timeAgo(pubDate){
  const t = new Date(pubDate).getTime();
  if (isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.round(hrs / 24) + 'd ago';
}

function wireItemHtml(h){
  return `
    <div class="wire-item">
      <div class="wire-title"><a href="${h.link}" target="_blank" rel="noopener">${h.title}</a></div>
      <div class="wire-meta">
        <span class="wire-tag">${h.source}</span>
        <span>${timeAgo(h.pubDate)}</span>
      </div>
    </div>`;
}

function renderOverviewWire(){
  const el = document.getElementById('overviewWire');
  const items = [...state.news].sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 6);
  el.innerHTML = items.length ? items.map(wireItemHtml).join('') : '<p class="empty-note">No headlines fetched yet.</p>';
}

function renderWireFull(){
  const select = document.getElementById('wireFilter');
  if (select.options.length <= 1){
    CONFIG.CURRENCIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      select.appendChild(opt);
    });
  }
  const filter = select.value;
  const el = document.getElementById('wireFull');
  let items = [...state.news].sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate));
  if (filter !== 'all'){
    const kws = CCY_KEYWORDS[filter] || [];
    items = items.filter(h => kws.some(k => (h.title + ' ' + h.description).toLowerCase().includes(k)));
  }
  items = items.slice(0, 40);
  el.innerHTML = items.length ? items.map(wireItemHtml).join('') : '<p class="empty-note">No headlines match this filter yet.</p>';
}

function renderPairTable(){
  const tbody = document.querySelector('#pairTable tbody');
  const filterVal = (document.getElementById('pairFilter').value || '').toUpperCase();
  const rows = state.pairs.filter(p => p.symbol.includes(filterVal));
  tbody.innerHTML = rows.map(p => `
    <tr>
      <td class="pair-symbol">${p.base}/${p.quote}</td>
      <td><span class="badge ${p.bias.cls}">${p.bias.label}</span></td>
      <td>
        <div class="split-bar">
          <div class="split-track"><div class="split-buy" style="width:${p.buyPct}%"></div><div class="split-sell" style="width:${p.sellPct}%"></div></div>
          <span class="split-label mono">${p.buyPct}% / ${p.sellPct}%</span>
        </div>
      </td>
      <td class="mono">${p.diff > 0 ? '+' : ''}${p.diff}</td>
      <td class="why-cell">${whyText(state.strength, p.base, p.quote)}</td>
    </tr>`).join('');
}

function assetCardHtml(symbol, name, score){
  const diff = score - 50;
  const bias = biasLabel(diff);
  const buyPct = diffToBuyPct(diff);
  return `
    <div class="asset-card">
      <div class="asset-card-head">
        <span class="asset-name">${symbol}</span>
        <span class="badge ${bias.cls}">${bias.label}</span>
      </div>
      <div class="split-bar">
        <div class="split-track"><div class="split-buy" style="width:${buyPct}%"></div><div class="split-sell" style="width:${100-buyPct}%"></div></div>
        <span class="split-label mono">${buyPct}%</span>
      </div>
      <div class="mover-reason" style="margin-top:0.5rem;">${name}</div>
    </div>`;
}

function renderAssetGroups(){
  const el = document.getElementById('assetGroups');
  const groups = [
    {title:'Indices', key:'indices', list: CONFIG.INDICES},
    {title:'Metals', key:'metals', list: CONFIG.METALS},
    {title:'Commodities', key:'oil', list: CONFIG.COMMODITIES},
    {title:'Crypto', key:'crypto', list: CONFIG.CRYPTO}
  ];
  el.innerHTML = groups.map(g => `
    <div>
      <p class="asset-group-title">${g.title}</p>
      <div class="asset-cards">
        ${g.list.map(a => assetCardHtml(a.symbol, a.name, state.assets[g.key])).join('')}
      </div>
    </div>`).join('');
}

function renderCalendarTable(){
  const tbody = document.querySelector('#calendarTable tbody');
  const events = [...state.calendarEvents]
    .filter(e => CONFIG.CURRENCIES.includes((e.country||'').toUpperCase()))
    .sort((a,b) => new Date(a.date) - new Date(b.date));
  if (!events.length){
    tbody.innerHTML = `<tr><td colspan="8" class="empty-note">No calendar data yet — refresh, or the calendar feed may be rate-limited right now.</td></tr>`;
    return;
  }
  tbody.innerHTML = events.map(e => {
    const dir = classifyEventDirection(e.title);
    let read = '—';
    const a = parseFloat(String(e.actual).replace(/[^\d.\-]/g,''));
    const f = parseFloat(String(e.forecast).replace(/[^\d.\-]/g,''));
    if (dir !== 0 && !isNaN(a) && !isNaN(f) && a !== f){
      const bullish = Math.sign(a - f) * dir > 0;
      read = bullish ? `<span style="color:var(--bull)">bullish ${e.country}</span>` : `<span style="color:var(--bear)">bearish ${e.country}</span>`;
    }
    const d = new Date(e.date);
    const dateStr = isNaN(d) ? e.date : d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
    return `<tr>
      <td class="mono">${dateStr}</td>
      <td>${e.country}</td>
      <td><span class="impact-dot impact-${e.impact}"></span>${e.impact}</td>
      <td>${e.title}</td>
      <td class="mono">${e.actual ?? '—'}</td>
      <td class="mono">${e.forecast ?? '—'}</td>
      <td class="mono">${e.previous ?? '—'}</td>
      <td>${read}</td>
    </tr>`;
  }).join('');
}

function renderSourceHealth(){
  const el = document.getElementById('sourceHealth');
  if (!state.sourceHealth.length){ el.innerHTML = '<p class="empty-note">Loading source status…</p>'; return; }
  el.innerHTML = state.sourceHealth.map(s => `
    <div class="source-row">
      <div class="source-name">
        <span>${s.name}</span>
        <span class="source-detail">${s.ok ? s.count + ' items fetched' : 'unreachable this refresh — using cache if available'}</span>
      </div>
      <span class="badge ${s.ok ? 'buy' : 'sell'}">${s.ok ? 'OK' : 'DOWN'}</span>
    </div>`).join('');
}

/* ------------------------------------------------------------
   INIT + EVENTS
   ------------------------------------------------------------ */

document.getElementById('tabNav').addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('is-active'));
  btn.classList.add('is-active');
  document.getElementById('pane-' + btn.dataset.tab).classList.add('is-active');
});

document.getElementById('pairFilter').addEventListener('input', renderPairTable);
document.getElementById('wireFilter').addEventListener('change', renderWireFull);

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('is-spinning');
  await loadData(true);
  btn.classList.remove('is-spinning');
});

loadData(false);
