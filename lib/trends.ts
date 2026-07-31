// Google Trends TÃ¼rkiye RSS beslemesi â€” admin paneline "gÃ¼ndem adayÄ±" Ã¶nerir.
// AÄŸ hatasÄ±nda sessizce boÅŸ dÃ¶ner; sonuÃ§ 30 dakika bellekte tutulur.

export type TrendCandidate = {
  title: string;
  traffic: string | null;
};

const FEED_URL = "https://trends.google.com/trending/rss?geo=TR";
const CACHE_MS = 30 * 60 * 1000;

const g = globalThis as unknown as {
  __tnTrendsCache?: { at: number; items: TrendCandidate[]; error: string | null };
};

function parseFeed(xml: string): TrendCandidate[] {
  const items: TrendCandidate[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const block of blocks) {
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
    const traffic = block.match(/<ht:approx_traffic>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/ht:approx_traffic>/)?.[1]?.trim() ?? null;
    if (title) items.push({ title, traffic });
  }
  return items.slice(0, 12);
}

export async function getGoogleTrends(): Promise<{ items: TrendCandidate[]; error: string | null }> {
  const cached = g.__tnTrendsCache;
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { items: cached.items, error: cached.error };
  }
  try {
    const res = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "TrendMatik/0.1 (+gundem-besleme)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseFeed(await res.text());
    g.__tnTrendsCache = { at: Date.now(), items, error: null };
    return { items, error: null };
  } catch (err) {
    const msg = `Google Trends beslemesine ulaÅŸÄ±lamadÄ± (${err instanceof Error ? err.message : "hata"}).`;
    g.__tnTrendsCache = { at: Date.now(), items: [], error: msg };
    return { items: [], error: msg };
  }
}
