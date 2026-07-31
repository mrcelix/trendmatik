import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "pg";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

// =============================================================================
// Veri katmanı — çift sürücü:
//   DATABASE_URL tanımlıysa  → Postgres (Supabase / Vercel)
//   tanımlı değilse          → yerel SQLite (data/trendmatik.db)
// Tüm sorgular '?' yer tutucusuyla yazılır; Postgres'e $1,$2… olarak çevrilir.
//
// ÖNEMLİ: sürücüler yalnızca kullanıldıklarında (dinamik import) yüklenir.
// node:sqlite'ı koşulsuz import etmek, sunucusuz ortamlarda (Vercel) derlemeyi
// ve çalışmayı bozar — orada yalnızca Postgres yolu kullanılır.
// =============================================================================

// ---- Tipler ----------------------------------------------------------------

export type Category = {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  sort: number;
};

export type Topic = {
  id: number;
  slug: string;
  title: string;
  description: string;
  category_id: number;
  city: string | null;
  status: "pending" | "approved" | "rejected";
  created_by: number | null;
  created_at: number;
};

export type Item = {
  id: number;
  topic_id: number;
  name: string;
  note: string;
  status: "active" | "candidate" | "pending" | "rejected";
  created_by: number | null;
  created_at: number;
};

export type ScoredItem = Item & {
  popScore: number;
  trendScore: number;
  voteCount: number;
  rank: number;
  delta: number | null; // null = YENİ (önceki günde yoktu)
};

export type TopicSummary = Topic & {
  categoryName: string;
  categorySlug: string;
  categoryEmoji: string;
  popScore: number;
  trendScore: number;
  voteCount: number;
  topItems: string[];
};

export type User = {
  id: number;
  username: string;
  pass_hash: string;
  role: "user" | "admin";
  created_at: number;
};

type Row = Record<string, unknown>;

// ---- Sürücü ------------------------------------------------------------------

const usePg = !!process.env.DATABASE_URL;

const g = globalThis as unknown as {
  __tmSqlite?: Promise<DatabaseSync>;
  __tmPool?: Promise<Pool>;
  __tmInit?: Promise<void>;
};

function sqliteDb(): Promise<DatabaseSync> {
  if (!g.__tmSqlite) {
    g.__tmSqlite = (async () => {
      if (process.env.VERCEL) {
        throw new Error(
          "Vercel'de yerel SQLite kullanılamaz (dosya sistemi kalıcı değil). " +
            "Proje ayarlarında DATABASE_URL ortam değişkenini Supabase bağlantı adresiyle tanımlayın."
        );
      }
      const { DatabaseSync } = await import("node:sqlite");
      const dir = path.join(process.cwd(), "data");
      mkdirSync(dir, { recursive: true });
      const db = new DatabaseSync(path.join(dir, "trendmatik.db"));
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
      return db;
    })();
  }
  return g.__tmSqlite;
}

function pgPool(): Promise<Pool> {
  if (!g.__tmPool) {
    g.__tmPool = (async () => {
      const mod = await import("pg");
      // pg CJS'tir; paketleyiciye göre namespace ya da .default gelebilir
      const pg = (mod as unknown as { default?: typeof import("pg") }).default ?? mod;
      // BIGINT (created_at) değerleri string değil sayı olarak gelsin
      pg.types.setTypeParser(20, (v: string) => Number(v));
      const url = process.env.DATABASE_URL!;
      return new pg.Pool({
        connectionString: url,
        max: 3, // sunucusuz ortamda örnek başına küçük havuz
        ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
      });
    })();
  }
  return g.__tmPool;
}

function toPgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

type SqlValue = string | number | null;

async function all(sql: string, params: SqlValue[] = []): Promise<Row[]> {
  if (usePg) {
    const res = await (await pgPool()).query(toPgSql(sql), params);
    return res.rows as Row[];
  }
  return (await sqliteDb()).prepare(sql).all(...params) as unknown as Row[];
}

async function get(sql: string, params: SqlValue[] = []): Promise<Row | undefined> {
  if (usePg) {
    const res = await (await pgPool()).query(toPgSql(sql), params);
    return res.rows[0] as Row | undefined;
  }
  return (await sqliteDb()).prepare(sql).get(...params) as unknown as Row | undefined;
}

async function run(sql: string, params: SqlValue[] = []): Promise<void> {
  if (usePg) {
    await (await pgPool()).query(toPgSql(sql), params);
    return;
  }
  (await sqliteDb()).prepare(sql).run(...params);
}

/** Çok satırlı INSERT — tohumlamayı binlerce gidiş-dönüşten kurtarır. */
async function insertMany(
  table: string,
  cols: string[],
  rows: SqlValue[][],
  chunkSize = 200
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const tuple = `(${cols.map(() => "?").join(",")})`;
    await run(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${slice.map(() => tuple).join(",")}`,
      slice.flat()
    );
  }
}

// ---- Başlatma (şema + tohum) ---------------------------------------------------

async function ensureInit(): Promise<void> {
  if (!g.__tmInit) {
    g.__tmInit = (async () => {
      await migrate();
      await seed();
    })().catch((err) => {
      g.__tmInit = undefined; // bir sonraki istekte yeniden dene
      throw err;
    });
  }
  return g.__tmInit;
}

async function migrate() {
  const id = usePg ? "id SERIAL PRIMARY KEY" : "id INTEGER PRIMARY KEY AUTOINCREMENT";
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      ${id},
      username TEXT NOT NULL${usePg ? "" : " UNIQUE COLLATE NOCASE"},
      pass_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at BIGINT NOT NULL
    )`,
    ...(usePg
      ? ["CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uname ON users (LOWER(username))"]
      : []),
    `CREATE TABLE IF NOT EXISTS categories (
      ${id},
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      sort INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS topics (
      ${id},
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category_id INTEGER NOT NULL REFERENCES categories(id),
      city TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_by INTEGER REFERENCES users(id),
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS items (
      ${id},
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_by INTEGER REFERENCES users(id),
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS votes (
      ${id},
      item_id INTEGER NOT NULL REFERENCES items(id),
      voter_key TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      value INTEGER NOT NULL,
      weight INTEGER NOT NULL DEFAULT 1,
      vote_date TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      UNIQUE(item_id, voter_key, vote_date)
    )`,
    `CREATE TABLE IF NOT EXISTS snapshots (
      ${id},
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      rank INTEGER NOT NULL,
      snap_date TEXT NOT NULL,
      UNIQUE(topic_id, item_id, snap_date)
    )`,
    `CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_votes_item ON votes(item_id)",
    "CREATE INDEX IF NOT EXISTS idx_items_topic ON items(topic_id)",
    "CREATE INDEX IF NOT EXISTS idx_snap_topic ON snapshots(topic_id, snap_date)",
  ];
  for (const s of stmts) await run(s);
}

// ---- Yardımcılar ------------------------------------------------------------

export function slugify(text: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return text
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** ISO hafta anahtarı: '2026-31' */
export function weekKeyOf(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; // Pazartesi=1 … Pazar=7
  t.setUTCDate(t.getUTCDate() + 4 - day); // haftanın perşembesi ISO yılını belirler
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

function monthKeyOf(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 7);
}

export function currentWeekKey(): string {
  return weekKeyOf(nowSec());
}

/**
 * Puan toplamını veritabanında hesaplayan SELECT.
 * Oy satırlarını ağ üzerinden çekip JS'te toplamak yerine tek satır özet döner —
 * uzak veritabanında (Supabase) fark kritik.
 *   pop   = Σ(değer × ağırlık)
 *   trend = Σ(değer × ağırlık / (yaş_saat + 2)^1.5)   [Hacker News tarzı çürüme]
 * POWER() hem SQLite hem Postgres'te mevcuttur; ilk parametre "şimdi"nin epoch değeri.
 */
function scoreSelect(groupCol: string): string {
  return `SELECT ${groupCol} AS grup,
            CAST(SUM(v.value * v.weight) AS DOUBLE PRECISION) AS pop,
            CAST(SUM((v.value * v.weight) /
                 POWER((? - v.created_at) / 3600.0 + 2, 1.5)) AS DOUBLE PRECISION) AS trend,
            COUNT(*) AS n
          FROM votes v JOIN items i ON i.id = v.item_id`;
}

type ScoreRow = { grup: number; pop: number; trend: number; n: number };

function scoreMap(rows: ScoreRow[]) {
  return new Map(
    rows.map((r) => [
      Number(r.grup),
      { pop: Number(r.pop) || 0, trend: Number(r.trend) || 0, count: Number(r.n) || 0 },
    ])
  );
}

const BOS_PUAN = { pop: 0, trend: 0, count: 0 };

// ---- Sorgular ---------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  await ensureInit();
  return (await all("SELECT * FROM categories ORDER BY sort, id")) as unknown as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  await ensureInit();
  return (await get("SELECT * FROM categories WHERE slug = ?", [slug])) as unknown as Category | undefined;
}

export async function getTopicBySlug(slug: string): Promise<Topic | undefined> {
  await ensureInit();
  return (await get("SELECT * FROM topics WHERE slug = ?", [slug])) as unknown as Topic | undefined;
}

/** Onaylı başlıkları kategori bilgisi + toplam puanlarla döndürür. */
export async function getTopicSummaries(categoryId?: number): Promise<TopicSummary[]> {
  await ensureInit();
  const base = `SELECT t.*, c.name AS "categoryName", c.slug AS "categorySlug", c.emoji AS "categoryEmoji"
                FROM topics t JOIN categories c ON c.id = t.category_id
                WHERE t.status = 'approved'`;
  const topics = (
    categoryId !== undefined
      ? await all(`${base} AND t.category_id = ? ORDER BY t.id`, [categoryId])
      : await all(`${base} ORDER BY t.id`)
  ) as unknown as (Topic & { categoryName: string; categorySlug: string; categoryEmoji: string })[];

  // Puanlar: başlık başına tek satır (JS'te toplama yok)
  const agg = scoreMap(
    (await all(
      `${scoreSelect("i.topic_id")} WHERE i.status IN ('active','candidate') GROUP BY i.topic_id`,
      [nowSec()]
    )) as unknown as ScoreRow[]
  );

  // Önizleme maddeleri: başlık başına ayrı sorgu yerine tek sorgu
  const onizleme = new Map<number, string[]>();
  const itemRows = (await all(
    "SELECT topic_id, name FROM items WHERE status = 'active' ORDER BY topic_id, id"
  )) as unknown as { topic_id: number; name: string }[];
  for (const r of itemRows) {
    const key = Number(r.topic_id);
    const liste = onizleme.get(key) ?? [];
    if (liste.length < 3) liste.push(r.name);
    onizleme.set(key, liste);
  }

  return topics.map((t) => {
    const a = agg.get(Number(t.id)) ?? BOS_PUAN;
    return {
      ...t,
      popScore: a.pop,
      trendScore: a.trend,
      voteCount: a.count,
      topItems: onizleme.get(Number(t.id)) ?? [],
    };
  });
}

export type MenuTopic = {
  id: number;
  slug: string;
  title: string;
  city: string | null;
  categorySlug: string;
  popScore: number;
  voteCount: number;
};

export type MenuItem = { id: number; name: string; topicSlug: string; topicTitle: string };

export type SiteStats = {
  listeler: number;
  oylar: number;
  kategoriler: number;
  bugunOy: number;
  maddeler: number;
};

/**
 * Üst bardaki mega menü, arama ve güven şeridinin verisi — her sayfada
 * yüklendiği için mümkün olan en az sorguyla.
 */
export async function getMenuData(): Promise<{
  categories: Category[];
  topics: MenuTopic[];
  items: MenuItem[];
  stats: SiteStats;
}> {
  await ensureInit();
  const categories = (await getCategories()).map((c) => ({
    id: Number(c.id),
    slug: c.slug,
    name: c.name,
    emoji: c.emoji,
    sort: Number(c.sort),
  }));

  const rows = (await all(
    `SELECT t.id, t.slug, t.title, t.city, c.slug AS "categorySlug",
            CAST(COALESCE(SUM(v.value * v.weight), 0) AS DOUBLE PRECISION) AS pop,
            COUNT(v.id) AS n
     FROM topics t
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN items i ON i.topic_id = t.id AND i.status IN ('active','candidate')
     LEFT JOIN votes v ON v.item_id = i.id
     WHERE t.status = 'approved'
     GROUP BY t.id, t.slug, t.title, t.city, c.slug`
  )) as unknown as {
    id: number; slug: string; title: string; city: string | null;
    categorySlug: string; pop: number; n: number;
  }[];

  const topics: MenuTopic[] = rows
    .map((r) => ({
      id: Number(r.id),
      slug: r.slug,
      title: r.title,
      city: r.city ?? null,
      categorySlug: r.categorySlug,
      popScore: Number(r.pop) || 0,
      voteCount: Number(r.n) || 0,
    }))
    .sort((a, b) => b.popScore - a.popScore);

  // Üst bar aramasının dizini: tüm aktif maddeler
  const itemRows = (await all(
    `SELECT i.id, i.name, t.slug AS "topicSlug", t.title AS "topicTitle"
     FROM items i JOIN topics t ON t.id = i.topic_id
     WHERE i.status = 'active' AND t.status = 'approved'
     ORDER BY i.id`
  )) as unknown as MenuItem[];
  const items: MenuItem[] = itemRows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    topicSlug: r.topicSlug,
    topicTitle: r.topicTitle,
  }));

  // Güven şeridi sayaçları — tek sorguda
  const s = (await get(
    `SELECT (SELECT COUNT(*) FROM topics WHERE status = 'approved') AS listeler,
            (SELECT COUNT(*) FROM votes) AS oylar,
            (SELECT COUNT(*) FROM categories) AS kategoriler,
            (SELECT COUNT(*) FROM items WHERE status = 'active') AS maddeler,
            (SELECT COUNT(*) FROM votes WHERE vote_date = ?) AS bugun`,
    [today()]
  )) as unknown as Record<string, number>;

  const stats: SiteStats = {
    listeler: Number(s?.listeler ?? 0),
    oylar: Number(s?.oylar ?? 0),
    kategoriler: Number(s?.kategoriler ?? 0),
    maddeler: Number(s?.maddeler ?? 0),
    bugunOy: Number(s?.bugun ?? 0),
  };

  return { categories, topics, items, stats };
}

export type HeroTopic = {
  id: number;
  slug: string;
  title: string;
  city: string | null;
  categorySlug: string;
  categoryName: string;
  categoryEmoji: string;
  voteCount: number;
  popScore: number;
  items: { id: number; name: string; pop: number }[];
};

/**
 * Hero'daki etkileşimli bulucunun verisi: kategoriler + onaylı başlıklar +
 * her başlığın ilk maddeleri. Tümü istemciye tek seferde gider; adımlar
 * arasında gezinirken sunucuya dönülmez.
 */
export async function getHeroData(
  perTopic = 5
): Promise<{ categories: Category[]; topics: HeroTopic[] }> {
  const [categories, summaries] = await Promise.all([getCategories(), getTopicSummaries()]);

  const itemRows = (await all(
    `SELECT i.id, i.topic_id, i.name,
            CAST(COALESCE(SUM(v.value * v.weight), 0) AS DOUBLE PRECISION) AS pop
     FROM items i
     LEFT JOIN votes v ON v.item_id = i.id
     WHERE i.status = 'active'
     GROUP BY i.id, i.topic_id, i.name`
  )) as unknown as { id: number; topic_id: number; name: string; pop: number }[];

  const byTopic = new Map<number, { id: number; name: string; pop: number }[]>();
  for (const r of itemRows) {
    const key = Number(r.topic_id);
    const liste = byTopic.get(key) ?? [];
    liste.push({ id: Number(r.id), name: r.name, pop: Number(r.pop) || 0 });
    byTopic.set(key, liste);
  }
  for (const liste of byTopic.values()) liste.sort((a, b) => b.pop - a.pop);

  // Sürücüler prototipsiz satır nesneleri döndürebiliyor; istemci bileşenine
  // yalnızca düz nesneler geçirilebildiği için alanları açıkça kopyalıyoruz.
  const duzKategoriler: Category[] = categories.map((c) => ({
    id: Number(c.id),
    slug: c.slug,
    name: c.name,
    emoji: c.emoji,
    sort: Number(c.sort),
  }));

  const topics: HeroTopic[] = summaries.map((t) => ({
    id: Number(t.id),
    slug: t.slug,
    title: t.title,
    city: t.city ?? null,
    categorySlug: t.categorySlug,
    categoryName: t.categoryName,
    categoryEmoji: t.categoryEmoji,
    voteCount: t.voteCount,
    popScore: t.popScore,
    items: (byTopic.get(Number(t.id)) ?? []).slice(0, perTopic),
  }));

  return { categories: duzKategoriler, topics };
}

export type Donem = "tum" | "ay" | "hafta" | "gun";

/** Dönem filtresinin başlangıç tarihi (YYYY-MM-DD); "tum" ise sınır yok. */
function donemBaslangici(donem: Donem): string | null {
  const gun = { tum: 0, ay: 30, hafta: 7, gun: 1 }[donem];
  if (!gun) return null;
  return new Date(Date.now() - (gun - 1) * 86400_000).toISOString().slice(0, 10);
}

/**
 * Bir başlığın Top 10 + aday maddelerini puanlanmış ve sıralanmış döndürür.
 * `donem` verilirse puanlar yalnızca o zaman aralığındaki oylardan hesaplanır
 * (▲▼ göstergeleri günlük anlık görüntüye dayandığı için değişmez).
 */
export async function getTopicBoard(
  topicId: number,
  donem: Donem = "tum"
): Promise<{ top: ScoredItem[]; candidates: ScoredItem[] }> {
  await ensureInit();
  const items = (await all(
    "SELECT * FROM items WHERE topic_id = ? AND status IN ('active','candidate')",
    [topicId]
  )) as unknown as Item[];

  const bas = donemBaslangici(donem);
  const agg = items.length
    ? scoreMap(
        (await all(
          `${scoreSelect("v.item_id")} WHERE i.topic_id = ?${bas ? " AND v.vote_date >= ?" : ""}
           GROUP BY v.item_id`,
          bas ? [nowSec(), topicId, bas] : [nowSec(), topicId]
        )) as unknown as ScoreRow[]
      )
    : new Map<number, typeof BOS_PUAN>();

  const scored = items.map((i) => {
    const a = agg.get(Number(i.id)) ?? BOS_PUAN;
    return { ...i, popScore: a.pop, trendScore: a.trend, voteCount: a.count, rank: 0, delta: null as number | null };
  });

  const active = scored
    .filter((i) => i.status === "active")
    .sort((a, b) => b.popScore - a.popScore || a.name.localeCompare(b.name, "tr"));
  active.forEach((i, idx) => (i.rank = idx + 1));

  const candidates = scored
    .filter((i) => i.status === "candidate")
    .sort((a, b) => b.popScore - a.popScore);

  await applySnapshotDeltas(topicId, active);
  return { top: active.slice(0, 10), candidates };
}

/** Günün ilk görüntülemesinde bugünün sıralamasını kaydeder; ▲▼ farkını önceki güne göre hesaplar. */
async function applySnapshotDeltas(topicId: number, ranked: ScoredItem[]) {
  const t = today();
  const hasToday = await get(
    "SELECT 1 AS x FROM snapshots WHERE topic_id = ? AND snap_date = ? LIMIT 1",
    [topicId, t]
  );
  if (!hasToday && ranked.length) {
    // Madde başına ayrı INSERT yerine tek çok satırlı INSERT
    const tuple = "(?,?,?,?)";
    await run(
      `INSERT INTO snapshots (topic_id, item_id, rank, snap_date)
       VALUES ${ranked.map(() => tuple).join(",")}
       ON CONFLICT (topic_id, item_id, snap_date) DO NOTHING`,
      ranked.flatMap((i) => [topicId, i.id, i.rank, t])
    );
  }
  const prevDate = (await get(
    "SELECT MAX(snap_date) AS d FROM snapshots WHERE topic_id = ? AND snap_date < ?",
    [topicId, t]
  )) as { d: string | null } | undefined;
  if (!prevDate?.d) return;
  const prev = (await all(
    "SELECT item_id, rank FROM snapshots WHERE topic_id = ? AND snap_date = ?",
    [topicId, prevDate.d]
  )) as unknown as { item_id: number; rank: number }[];
  const prevMap = new Map(prev.map((p) => [Number(p.item_id), Number(p.rank)]));
  for (const i of ranked) {
    const p = prevMap.get(Number(i.id));
    i.delta = p === undefined ? null : p - i.rank;
  }
}

export async function getItemById(id: number): Promise<Item | undefined> {
  await ensureInit();
  return (await get("SELECT * FROM items WHERE id = ?", [id])) as unknown as Item | undefined;
}

/** Oy kullan / günceller. */
export async function castVote(opts: {
  itemId: number;
  voterKey: string;
  userId: number | null;
  value: 1 | -1;
  weight: number;
}): Promise<{ ok: boolean; changed: boolean }> {
  await ensureInit();
  const existing = (await get(
    "SELECT id, value FROM votes WHERE item_id = ? AND voter_key = ? AND vote_date = ?",
    [opts.itemId, opts.voterKey, today()]
  )) as { id: number; value: number } | undefined;
  if (existing) {
    if (Number(existing.value) === opts.value) return { ok: true, changed: false };
    await run("UPDATE votes SET value = ?, weight = ?, created_at = ? WHERE id = ?", [
      opts.value, opts.weight, nowSec(), existing.id,
    ]);
    return { ok: true, changed: true };
  }
  await run(
    `INSERT INTO votes (item_id, voter_key, user_id, value, weight, vote_date, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [opts.itemId, opts.voterKey, opts.userId, opts.value, opts.weight, today(), nowSec()]
  );
  return { ok: true, changed: true };
}

export async function getVotesOfVoterForTopic(
  topicId: number,
  voterKey: string
): Promise<Map<number, number>> {
  await ensureInit();
  const rows = (await all(
    `SELECT v.item_id, v.value FROM votes v JOIN items i ON i.id = v.item_id
     WHERE i.topic_id = ? AND v.voter_key = ? AND v.vote_date = ?`,
    [topicId, voterKey, today()]
  )) as unknown as { item_id: number; value: number }[];
  return new Map(rows.map((r) => [Number(r.item_id), Number(r.value)]));
}

// ---- Öneriler / Admin --------------------------------------------------------

export async function createTopicSuggestion(opts: {
  title: string;
  description: string;
  categoryId: number;
  city: string | null;
  userId: number;
  itemNames: string[];
  status?: "pending" | "approved";
}): Promise<{ id: number; slug: string }> {
  await ensureInit();
  let slug = slugify(opts.title);
  if (await get("SELECT 1 AS x FROM topics WHERE slug = ?", [slug])) {
    slug = `${slug}-${randomUUID().slice(0, 6)}`;
  }
  const row = (await get(
    `INSERT INTO topics (slug, title, description, category_id, city, status, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
    [slug, opts.title, opts.description, opts.categoryId, opts.city, opts.status ?? "pending", opts.userId, nowSec()]
  )) as { id: number };
  const topicId = Number(row.id);
  for (const name of opts.itemNames.slice(0, 10)) {
    await run(
      "INSERT INTO items (topic_id, name, status, created_by, created_at) VALUES (?,?,'active',?,?)",
      [topicId, name, opts.userId, nowSec()]
    );
  }
  return { id: topicId, slug };
}

export async function createItemSuggestion(topicId: number, name: string, userId: number) {
  await ensureInit();
  await run(
    "INSERT INTO items (topic_id, name, status, created_by, created_at) VALUES (?,?,'pending',?,?)",
    [topicId, name, userId, nowSec()]
  );
}

export async function getPendingTopics(): Promise<
  (Topic & { categoryName: string; suggestedBy: string | null })[]
> {
  await ensureInit();
  return (await all(
    `SELECT t.*, c.name AS "categoryName", u.username AS "suggestedBy"
     FROM topics t JOIN categories c ON c.id = t.category_id
     LEFT JOIN users u ON u.id = t.created_by
     WHERE t.status = 'pending' ORDER BY t.created_at`
  )) as unknown as (Topic & { categoryName: string; suggestedBy: string | null })[];
}

export async function getPendingItems(): Promise<
  (Item & { topicTitle: string; suggestedBy: string | null })[]
> {
  await ensureInit();
  return (await all(
    `SELECT i.*, t.title AS "topicTitle", u.username AS "suggestedBy"
     FROM items i JOIN topics t ON t.id = i.topic_id
     LEFT JOIN users u ON u.id = i.created_by
     WHERE i.status = 'pending' ORDER BY i.created_at`
  )) as unknown as (Item & { topicTitle: string; suggestedBy: string | null })[];
}

export async function setTopicStatus(topicId: number, status: "approved" | "rejected") {
  await ensureInit();
  await run("UPDATE topics SET status = ? WHERE id = ?", [status, topicId]);
}

export async function setItemStatus(itemId: number, status: "active" | "candidate" | "rejected") {
  await ensureInit();
  await run("UPDATE items SET status = ? WHERE id = ?", [status, itemId]);
}

export async function getAllApprovedTopics(): Promise<(Topic & { categoryName: string })[]> {
  await ensureInit();
  return (await all(
    `SELECT t.*, c.name AS "categoryName" FROM topics t
     JOIN categories c ON c.id = t.category_id
     WHERE t.status = 'approved' ORDER BY c.sort, t.title`
  )) as unknown as (Topic & { categoryName: string })[];
}

// ---- Zirve arşivi -------------------------------------------------------------

export type ChampionRow = {
  period: string;       // '2026-31' (hafta) veya '2026-07' (ay)
  topic_id: number;
  topicTitle: string;
  topicSlug: string;
  itemName: string;
  points: number;
};

type ArchiveVoteRow = {
  vote_date: string; pts: number;
  item_id: number; name: string; topic_id: number; title: string; slug: string;
};

async function championsByPeriod(kind: "week" | "month"): Promise<Map<string, ChampionRow[]>> {
  await ensureInit();
  // Gün + madde bazında önceden toplanmış satırlar; tüm oy tablosu ağdan geçmez.
  const rows = (await all(
    `SELECT v.vote_date, i.id AS item_id, i.name, i.topic_id, t.title, t.slug,
            CAST(SUM(v.value * v.weight) AS DOUBLE PRECISION) AS pts
     FROM votes v
     JOIN items i ON i.id = v.item_id
     JOIN topics t ON t.id = i.topic_id
     WHERE t.status = 'approved' AND i.status = 'active'
     GROUP BY v.vote_date, i.id, i.name, i.topic_id, t.title, t.slug`
  )) as unknown as ArchiveVoteRow[];

  // dönem+madde bazında puan topla
  const pts = new Map<string, { period: string; row: ArchiveVoteRow; total: number }>();
  for (const r of rows) {
    const epoch = Date.parse(`${r.vote_date}T12:00:00Z`) / 1000;
    const period = kind === "week" ? weekKeyOf(epoch) : monthKeyOf(epoch);
    const key = `${period}|${r.item_id}`;
    const cur = pts.get(key) ?? { period, row: r, total: 0 };
    cur.total += Number(r.pts);
    pts.set(key, cur);
  }
  // her (dönem, başlık) için en yüksek puanlı madde
  const best = new Map<string, { period: string; row: ArchiveVoteRow; total: number }>();
  for (const e of pts.values()) {
    const key = `${e.period}|${e.row.topic_id}`;
    const cur = best.get(key);
    if (!cur || e.total > cur.total) best.set(key, e);
  }
  const byPeriod = new Map<string, ChampionRow[]>();
  for (const e of best.values()) {
    const list = byPeriod.get(e.period) ?? [];
    list.push({
      period: e.period,
      topic_id: Number(e.row.topic_id),
      topicTitle: e.row.title,
      topicSlug: e.row.slug,
      itemName: e.row.name,
      points: e.total,
    });
    byPeriod.set(e.period, list);
  }
  for (const list of byPeriod.values()) list.sort((a, b) => b.points - a.points);
  return byPeriod;
}

export async function getWeeklyArchive(): Promise<Map<string, ChampionRow[]>> {
  return championsByPeriod("week");
}

export async function getMonthlyArchive(): Promise<Map<string, ChampionRow[]>> {
  return championsByPeriod("month");
}

/** Bir epoch'un ait olduğu ISO haftasının [pazartesi, pazar] tarihleri. */
function weekRange(unixSec: number): [string, string] {
  const d = new Date(unixSec * 1000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const gun = t.getUTCDay() || 7; // Pazartesi=1 … Pazar=7
  const pazartesi = new Date(t);
  pazartesi.setUTCDate(t.getUTCDate() - gun + 1);
  const pazar = new Date(pazartesi);
  pazar.setUTCDate(pazartesi.getUTCDate() + 6);
  return [pazartesi.toISOString().slice(0, 10), pazar.toISOString().slice(0, 10)];
}

/**
 * Geçen haftanın şampiyonu (🏆 rozeti için) — yalnızca ilgili başlık ve
 * ilgili hafta sorgulanır; tüm arşivi taramaz.
 */
export async function getLastWeekChampion(
  topicId: number
): Promise<{ itemName: string; points: number } | undefined> {
  await ensureInit();
  const [bas, son] = weekRange(nowSec() - 7 * 86400);
  const row = (await get(
    `SELECT i.name, CAST(SUM(v.value * v.weight) AS DOUBLE PRECISION) AS pts
     FROM votes v JOIN items i ON i.id = v.item_id
     WHERE i.topic_id = ? AND i.status = 'active'
       AND v.vote_date >= ? AND v.vote_date <= ?
     GROUP BY i.id, i.name
     ORDER BY pts DESC
     LIMIT 1`,
    [topicId, bas, son]
  )) as { name: string; pts: number } | undefined;
  return row ? { itemName: row.name, points: Number(row.pts) } : undefined;
}

// ---- Oy anomalileri (son 24 saat) ----------------------------------------------

export type AnomalyReport = {
  heavyVoters: { voter_key: string; n: number; isGuest: boolean }[];
  hotGuestItems: { itemName: string; topicTitle: string; topicSlug: string; n: number }[];
};

export async function getVoteAnomalies(): Promise<AnomalyReport> {
  await ensureInit();
  const since = nowSec() - 86400;
  const heavyVoters = (
    (await all(
      `SELECT voter_key, COUNT(*) AS n, MAX(user_id) AS uid
       FROM votes WHERE created_at > ? AND voter_key NOT LIKE 'seed-%'
       GROUP BY voter_key HAVING COUNT(*) >= 8 ORDER BY COUNT(*) DESC LIMIT 15`,
      [since]
    )) as unknown as { voter_key: string; n: number; uid: number | null }[]
  ).map((r) => ({ voter_key: r.voter_key, n: Number(r.n), isGuest: r.uid === null }));

  const hotGuestItems = (
    (await all(
      `SELECT i.name AS "itemName", t.title AS "topicTitle", t.slug AS "topicSlug", COUNT(*) AS n
       FROM votes v
       JOIN items i ON i.id = v.item_id
       JOIN topics t ON t.id = i.topic_id
       WHERE v.created_at > ? AND v.user_id IS NULL AND v.voter_key NOT LIKE 'seed-%'
       GROUP BY i.id, i.name, t.title, t.slug HAVING COUNT(*) >= 5 ORDER BY COUNT(*) DESC LIMIT 10`,
      [since]
    )) as unknown as AnomalyReport["hotGuestItems"]
  ).map((r) => ({ ...r, n: Number(r.n) }));

  return { heavyVoters, hotGuestItems };
}

// ---- Kullanıcılar ------------------------------------------------------------

export async function getUserByUsername(username: string): Promise<User | undefined> {
  await ensureInit();
  return (await get(
    "SELECT * FROM users WHERE LOWER(username) = LOWER(?)",
    [username]
  )) as unknown as User | undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  await ensureInit();
  return (await get("SELECT * FROM users WHERE id = ?", [id])) as unknown as User | undefined;
}

export async function createUser(
  username: string,
  passHash: string,
  role: "user" | "admin" = "user"
): Promise<number> {
  await ensureInit();
  const row = (await get(
    "INSERT INTO users (username, pass_hash, role, created_at) VALUES (?,?,?,?) RETURNING id",
    [username, passHash, role, nowSec()]
  )) as { id: number };
  return Number(row.id);
}

// ---- Tohum verisi ------------------------------------------------------------

async function seed() {
  // Atomik kilit: eşzamanlı sunucusuz örneklerden yalnızca biri tohumlar.
  const claim = await get(
    "INSERT INTO meta (key, value) VALUES ('seeded','1') ON CONFLICT (key) DO NOTHING RETURNING key"
  );
  if (!claim) return;

  // meta tablosundan önce kurulmuş veritabanları: veri zaten varsa dokunma
  const existing = (await get("SELECT COUNT(*) AS n FROM categories")) as { n: number };
  if (Number(existing.n) > 0) return;

  // Varsayılan yönetici: admin / trendmatik2026!  (ilk girişten sonra değiştirin)
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync("trendmatik2026!", salt, 64).toString("hex");
  await run("INSERT INTO users (username, pass_hash, role, created_at) VALUES (?,?,?,?)", [
    "admin", `${salt}:${hash}`, "admin", nowSec(),
  ]);

  const cats: [string, string, string][] = [
    ["mekan", "Mekan", "📍"],
    ["hizmet", "Hizmet", "🛎️"],
    ["website", "Website", "🌐"],
    ["konu", "Konu", "💬"],
    ["urun", "Ürün", "📦"],
    ["haber", "Haber", "📰"],
  ];
  await insertMany(
    "categories",
    ["slug", "name", "emoji", "sort"],
    cats.map((c, i) => [c[0], c[1], c[2], i])
  );

  const topics: { cat: string; title: string; desc: string; city: string | null; items: string[] }[] = [
    {
      cat: "mekan", city: "İstanbul",
      title: "İstanbul'da Trend Kahve Mekanları",
      desc: "Sosyal medyada en çok konuşulan, kuyruğu eksik olmayan üçüncü nesil kahveciler.",
      items: ["Petra Roasting Co.", "Norm Coffee", "MOC İstanbul", "Kronotrop", "Espresso Lab", "Coffee Sapiens", "Brew Coffeeworks", "Ministry of Coffee", "Federal Coffee", "Story Coffee"],
    },
    {
      cat: "mekan", city: "Ankara",
      title: "Ankara'nın Popüler Kahvaltı Mekanları",
      desc: "Hafta sonu sabahlarının vazgeçilmezi serpme ve butik kahvaltıcılar.",
      items: ["Quick China Kahvaltı", "Mado Park", "Sini Kahvaltı", "Beyaz Fırın", "Kalbur", "Nusr-Et Kahvaltı", "Simit Sarayı Premium", "Van Kahvaltı Sofrası", "Çengelhan", "Café des Cafés"],
    },
    {
      cat: "hizmet", city: null,
      title: "Türkiye'de En Çok Kullanılan Yemek Sipariş Uygulamaları",
      desc: "Kapıya gelen lezzetin arkasındaki uygulamalar.",
      items: ["Yemeksepeti", "Getir Yemek", "Trendyol Yemek", "Migros Yemek", "Fuudy", "Tıkla Gelsin", "Vigo", "Bolt Food", "İyi Sofra", "Paket Servis TR"],
    },
    {
      cat: "website", city: null,
      title: "Türkiye'nin En Popüler E-Ticaret Siteleri",
      desc: "Sepetleri dolduran, kargoları koşturan platformlar.",
      items: ["Trendyol", "Hepsiburada", "Amazon TR", "N11", "Pazarama", "Çiçeksepeti", "Morhipo", "GittiGidiyor Yeni", "Vatan Bilgisayar", "Teknosa"],
    },
    {
      cat: "website", city: null,
      title: "Gençlerin En Çok Vakit Geçirdiği Platformlar",
      desc: "Ekran sürelerini domine eden uygulama ve siteler.",
      items: ["TikTok", "Instagram", "YouTube", "X (Twitter)", "Discord", "Twitch", "Reddit", "BeReal", "Pinterest", "LinkedIn"],
    },
    {
      cat: "konu", city: null,
      title: "Bu Haftanın Gündem Konuları",
      desc: "Türkiye'nin bu hafta en çok konuştuğu başlıklar.",
      items: ["Asgari ücret zammı", "Süper Lig şampiyonluk yarışı", "Yapay zekâ ve iş dünyası", "Elektrikli araç fiyatları", "Yaz tatili rotaları", "Kira artış oranları", "Üniversite tercihleri", "Sokak lezzetleri akımı", "Dizi finalleri", "Kripto piyasası"],
    },
    {
      cat: "urun", city: null,
      title: "Trend Teknoloji Ürünleri",
      desc: "Vitrinlerde ve sepetlerde en çok aranan cihazlar.",
      items: ["Akıllı saat", "Kablosuz kulaklık", "Robot süpürge", "Airfryer", "Katlanabilir telefon", "Taşınabilir projeksiyon", "E-scooter", "Akıllı ev asistanı", "Oyun konsolu", "Drone"],
    },
    {
      cat: "haber", city: null,
      title: "Bu Ayın En Çok Konuşulan Haberleri",
      desc: "Manşetlerden düşmeyen gelişmeler.",
      items: ["Ekonomi paketi açıklaması", "Milli takım galibiyeti", "Teknoloji devinin Türkiye yatırımı", "Yeni ulaşım hattı açılışı", "Sağlıkta yeni düzenleme", "Eğitim müfredatı tartışması", "Turizm rekoru", "Enerji keşfi", "Sinema ödülleri", "Hava durumu uyarıları"],
    },
  ];

  const now = nowSec();
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  const catIds = new Map(
    ((await all("SELECT id, slug FROM categories")) as unknown as { id: number; slug: string }[]).map(
      (c) => [c.slug, Number(c.id)]
    )
  );

  // Başlıklar tek seferde
  await insertMany(
    "topics",
    ["slug", "title", "description", "category_id", "city", "status", "created_by", "created_at"],
    topics.map((t) => [
      slugify(t.title), t.title, t.desc, catIds.get(t.cat)!, t.city, "approved", null, now - 86400 * 14,
    ])
  );
  const topicIds = new Map(
    ((await all("SELECT id, slug FROM topics")) as unknown as { id: number; slug: string }[]).map(
      (t) => [t.slug, Number(t.id)]
    )
  );

  // Maddeler (aktif + aday) tek seferde
  const itemRows: SqlValue[][] = [];
  for (const t of topics) {
    const topicId = topicIds.get(slugify(t.title))!;
    for (const name of t.items) itemRows.push([topicId, name, "active", null, now - 86400 * 14]);
    for (const c of ["Yeni aday: mahalle favorisi", "Yükselen alternatif"]) {
      itemRows.push([topicId, c, "candidate", null, now - 86400 * 2]);
    }
  }
  await insertMany("items", ["topic_id", "name", "status", "created_by", "created_at"], itemRows);

  const allItems = (await all(
    "SELECT id, topic_id, name, status FROM items ORDER BY id"
  )) as unknown as { id: number; topic_id: number; name: string; status: string }[];

  // Oylar ve dünün anlık görüntüsü — hepsi toplu
  const voteRows: SqlValue[][] = [];
  const snapRows: SqlValue[][] = [];
  for (const t of topics) {
    const topicId = topicIds.get(slugify(t.title))!;
    const active = allItems.filter((i) => Number(i.topic_id) === topicId && i.status === "active");
    const order = new Map(t.items.map((name, idx) => [name, idx]));
    active.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));

    active.forEach((item, idx) => {
      // Üst sıradakilere daha çok oy: gerçekçi bir dağılım + son günlerde rastgele yoğunluk
      const base = Math.max(4, 40 - idx * 4 + Math.floor(Math.random() * 8));
      for (let v = 0; v < base; v++) {
        const created = now - Math.floor(Math.random() * 10 * 86400);
        voteRows.push([
          Number(item.id),
          `seed-${randomUUID()}`,
          null,
          Math.random() < 0.88 ? 1 : -1,
          Math.random() < 0.35 ? 2 : 1,
          new Date(created * 1000).toISOString().slice(0, 10),
          created,
        ]);
      }
    });

    // Dünkü sıra bugünkünden hafif farklı olsun ki ▲▼ göstergeleri canlansın
    const ranks = active.map((item, idx) => ({ id: Number(item.id), rank: idx + 1 }));
    for (let i = 0; i < ranks.length - 1; i += 3) {
      const tmp = ranks[i].rank;
      ranks[i].rank = ranks[i + 1].rank;
      ranks[i + 1].rank = tmp;
    }
    for (const r of ranks) snapRows.push([topicId, r.id, r.rank, yesterday]);
  }

  await insertMany(
    "votes",
    ["item_id", "voter_key", "user_id", "value", "weight", "vote_date", "created_at"],
    voteRows
  );
  await insertMany("snapshots", ["topic_id", "item_id", "rank", "snap_date"], snapRows);
}
