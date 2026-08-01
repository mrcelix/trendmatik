import type { DatabaseSync } from "node:sqlite";
import type { Pool } from "pg";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { hataBildir } from "./hata";

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
  /** https görsel adresi; boşsa harf avatarı çizilir */
  gorsel?: string;
  /** Maddenin web adresi — og:image buradan çekilir, kart bağlantısı olur */
  site?: string;
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
  /** Görünen ad — profil adresinde de kullanılır */
  username: string;
  /** Giriş kimliği */
  email: string;
  pass_hash: string;
  role: "user" | "admin";
  created_at: number;
  /** 1 ise üye askıya alınmıştır: giriş yapamaz */
  askida?: number;
  /** 1 ise e-posta adresi doğrulanmıştır (Google ile gelenler doğrudan 1) */
  eposta_dogrulandi?: number;
  /** Google ile bağlandıysa Google'ın kullanıcı kimliği */
  google_id?: string;
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
      // Göç hatası tüm sayfaları düşürür; kaydı ilk elden alalım
      hataBildir(err, { nerede: "veritabani:baslatma", ek: { surucu: usePg ? "pg" : "sqlite" } });
      throw err;
    });
  }
  return g.__tmInit;
}

/**
 * Var olan tabloya sütun ekler (yoksa). CREATE TABLE IF NOT EXISTS mevcut
 * tabloyu değiştirmediği için şema geliştikçe buna ihtiyaç var.
 * İki lehçede de sütun listesini okuyup eksikse ALTER TABLE çalıştırır.
 */
async function sutunEkle(tablo: string, sutun: string, tanim: string) {
  // Postgres'te ADD COLUMN IF NOT EXISTS zaten etkisiz-tekrarlanabilir ve adı
  // search_path'e göre çözer. Önceki sürüm information_schema.columns'a şema
  // filtresi olmadan bakıyordu; Supabase'de auth.users da bulunduğu için onun
  // email sütununu görüp public.users'a ALTER çalıştırmıyordu.
  if (usePg) {
    await run(`ALTER TABLE ${tablo} ADD COLUMN IF NOT EXISTS ${sutun} ${tanim}`);
    return;
  }

  // SQLite'ta IF NOT EXISTS yok; sütun listesini okuyup karar veriyoruz.
  const sutunlar = (await all(`PRAGMA table_info(${tablo})`)) as unknown as { name: string }[];
  if (!sutunlar.some((c) => c.name === sutun)) {
    await run(`ALTER TABLE ${tablo} ADD COLUMN ${sutun} ${tanim}`);
  }
}

/**
 * Bir işi veritabanı ömrü boyunca yalnızca bir kez çalıştırır.
 * meta tablosuna atomik olarak işaret bırakır; eşzamanlı sunucusuz
 * örneklerden yalnızca biri işi üstlenir (seed() ile aynı kalıp).
 */
async function birKez(anahtar: string, is: () => Promise<void>): Promise<void> {
  const kapma = await get(
    "INSERT INTO meta (key, value) VALUES (?, '1') ON CONFLICT (key) DO NOTHING RETURNING key",
    [anahtar]
  );
  if (kapma) await is();
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
    `CREATE TABLE IF NOT EXISTS comments (
      ${id},
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',
      created_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_comments_topic ON comments(topic_id, status)",
    `CREATE TABLE IF NOT EXISTS notifications (
      ${id},
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '/',
      okundu INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, okundu)",
    `CREATE TABLE IF NOT EXISTS reranks (
      ${id},
      user_id INTEGER NOT NULL REFERENCES users(id),
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      position INTEGER NOT NULL,
      puan INTEGER NOT NULL,
      created_at BIGINT NOT NULL,
      UNIQUE(user_id, topic_id, item_id)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_rerank_topic ON reranks(topic_id)",
    `CREATE TABLE IF NOT EXISTS duels (
      ${id},
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      kazanan_id INTEGER NOT NULL REFERENCES items(id),
      kaybeden_id INTEGER NOT NULL REFERENCES items(id),
      voter_key TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      duel_date TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_duel_topic ON duels(topic_id)",
    "CREATE INDEX IF NOT EXISTS idx_duel_voter ON duels(voter_key, duel_date)",
    `CREATE TABLE IF NOT EXISTS elo (
      item_id INTEGER PRIMARY KEY REFERENCES items(id),
      puan INTEGER NOT NULL DEFAULT 1500,
      mac INTEGER NOT NULL DEFAULT 0
    )`,
    "CREATE INDEX IF NOT EXISTS idx_votes_item ON votes(item_id)",
    "CREATE INDEX IF NOT EXISTS idx_items_topic ON items(topic_id)",
    "CREATE INDEX IF NOT EXISTS idx_snap_topic ON snapshots(topic_id, snap_date)",
  ];
  // --- Yönetim paneli tabloları ---
  stmts.push(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      ${id},
      user_id INTEGER REFERENCES users(id),
      username TEXT NOT NULL,
      eylem TEXT NOT NULL,
      hedef TEXT NOT NULL,
      detay TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_audit_zaman ON audit_log(created_at)",
    `CREATE TABLE IF NOT EXISTS blog_posts (
      ${id},
      slug TEXT NOT NULL UNIQUE,
      baslik TEXT NOT NULL,
      ozet TEXT NOT NULL DEFAULT '',
      icerik TEXT NOT NULL DEFAULT '',
      kapak TEXT NOT NULL DEFAULT '',
      durum TEXT NOT NULL DEFAULT 'taslak',
      yazar_id INTEGER REFERENCES users(id),
      goruntulenme INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_blog_durum ON blog_posts(durum, created_at)",
    `CREATE TABLE IF NOT EXISTS follows (
      ${id},
      user_id INTEGER NOT NULL REFERENCES users(id),
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      son_bildirim TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      UNIQUE(user_id, topic_id)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_takip_topic ON follows(topic_id)",
    `CREATE TABLE IF NOT EXISTS predictions (
      ${id},
      user_id INTEGER NOT NULL REFERENCES users(id),
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      hafta TEXT NOT NULL,
      sonuc TEXT NOT NULL DEFAULT 'bekliyor',
      created_at BIGINT NOT NULL,
      UNIQUE(user_id, topic_id, hafta)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_tahmin_hafta ON predictions(hafta, sonuc)",
    `CREATE TABLE IF NOT EXISTS events (
      ${id},
      tur TEXT NOT NULL,
      yol TEXT NOT NULL DEFAULT '',
      hedef TEXT NOT NULL DEFAULT '',
      voter_key TEXT NOT NULL DEFAULT '',
      gun TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_event_gun ON events(gun, tur)",
    "CREATE INDEX IF NOT EXISTS idx_event_yol ON events(yol)",
    // E-posta doğrulama ve parola sıfırlama jetonları.
    // Ham jeton hiçbir zaman saklanmaz; yalnızca SHA-256 özeti tutulur.
    `CREATE TABLE IF NOT EXISTS auth_tokens (
      ${id},
      user_id INTEGER NOT NULL,
      tur TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires BIGINT NOT NULL,
      kullanildi INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_token_hash ON auth_tokens(token_hash)",
    "CREATE INDEX IF NOT EXISTS idx_token_user ON auth_tokens(user_id, tur)",
    // Haftalık bülten aboneleri — çift onaylı (onay e-postası tıklanmadan gönderim yok)
    `CREATE TABLE IF NOT EXISTS bulten (
      ${id},
      email TEXT NOT NULL,
      onaylandi INTEGER NOT NULL DEFAULT 0,
      onay_token TEXT NOT NULL DEFAULT '',
      cikis_token TEXT NOT NULL,
      kaynak TEXT NOT NULL DEFAULT '',
      son_gonderim BIGINT NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    )`,
    ...(usePg
      ? ["CREATE UNIQUE INDEX IF NOT EXISTS idx_bulten_email ON bulten (LOWER(email))"]
      : ["CREATE UNIQUE INDEX IF NOT EXISTS idx_bulten_email ON bulten (email COLLATE NOCASE)"]),
    "CREATE INDEX IF NOT EXISTS idx_bulten_cikis ON bulten(cikis_token)",
    // Oy sahtekârlığı savunması: oy verenin geçmişi (güven ağırlığı buradan çıkar)
    `CREATE TABLE IF NOT EXISTS voter_profile (
      voter_key TEXT PRIMARY KEY,
      ilk_gorulme BIGINT NOT NULL,
      son_oy BIGINT NOT NULL DEFAULT 0,
      oy_sayisi INTEGER NOT NULL DEFAULT 0
    )`,
    // Reddedilen oyların günlük sayacı (yönetim panelinde gösterilir)
    `CREATE TABLE IF NOT EXISTS vote_rejects (
      gun TEXT NOT NULL,
      sebep TEXT NOT NULL,
      adet INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (gun, sebep)
    )`,
    // Gündem taramasında işlenmiş başlıklar — aynı gündem maddesi
    // her taramada yeniden taslak üretmesin diye
    `CREATE TABLE IF NOT EXISTS gundem_kayit (
      anahtar TEXT PRIMARY KEY,
      baslik TEXT NOT NULL,
      sonuc TEXT NOT NULL,
      hedef TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_gundem_zaman ON gundem_kayit(created_at)",
    // Web push abonelikleri. endpoint tarayıcı+cihaz başına benzersizdir.
    `CREATE TABLE IF NOT EXISTS push_abone (
      ${id},
      user_id INTEGER REFERENCES users(id),
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_push_user ON push_abone(user_id)"
  );

  for (const s of stmts) await run(s);

  // --- Sonradan eklenen sütunlar ---
  await sutunEkle("topics", "one_cikan", "INTEGER NOT NULL DEFAULT 0"); // hero'da göster
  await sutunEkle("topics", "hero_sira", "INTEGER NOT NULL DEFAULT 0");
  await sutunEkle("topics", "menude", "INTEGER NOT NULL DEFAULT 1"); // mega menüde göster
  await sutunEkle("topics", "guncellendi", "BIGINT NOT NULL DEFAULT 0");
  await sutunEkle("items", "sabit", "INTEGER NOT NULL DEFAULT 0"); // sırayı elle sabitle
  await sutunEkle("items", "elle_sira", "INTEGER NOT NULL DEFAULT 0");
  // Görseller: madde ve liste kapağı. Yalnızca https adresleri kabul edilir.
  await sutunEkle("items", "gorsel", "TEXT NOT NULL DEFAULT ''");
  await sutunEkle("items", "site", "TEXT NOT NULL DEFAULT ''"); // maddenin web adresi
  await sutunEkle("topics", "kapak", "TEXT NOT NULL DEFAULT ''");
  await sutunEkle("categories", "aktif", "INTEGER NOT NULL DEFAULT 1");
  await sutunEkle("users", "askida", "INTEGER NOT NULL DEFAULT 0");
  // E-posta tabanlı üyelik: e-posta giriş kimliği, username görünen ad olarak kalır
  await sutunEkle("users", "email", "TEXT NOT NULL DEFAULT ''");
  await sutunEkle("users", "google_id", "TEXT NOT NULL DEFAULT ''");

  // Eski üyelerin e-postası yok; giriş yapabilmeleri için yer tutucu doldurulur
  await run(
    `UPDATE users SET email = LOWER(username) || '@trendmatik.local'
     WHERE email = '' OR email IS NULL`
  );
  // Oyun geldiği ağın günlük özeti — ham IP saklanmaz, özet her gün değişir
  await sutunEkle("votes", "ip_gun", "TEXT NOT NULL DEFAULT ''");
  await run("CREATE INDEX IF NOT EXISTS idx_votes_ipgun ON votes(ip_gun, vote_date)");

  await sutunEkle("users", "eposta_dogrulandi", "INTEGER NOT NULL DEFAULT 0");
  // Sütun eklenmeden önce var olan üyeler devredilir: adreslerini doğrulamalarını
  // isteyemeyiz (çoğunun yer tutucu adresi var), aksi halde hepsi kilitlenirdi.
  await birKez("devir:eposta-dogrulama", () =>
    run("UPDATE users SET eposta_dogrulandi = 1")
  );

  await run(
    usePg
      ? "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email))"
      : "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email COLLATE NOCASE)"
  );
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

/** Yönetim için tüm kategoriler + içerdikleri liste sayısı. */
export async function getCategoriesAdmin(): Promise<(Category & { aktif: number; listeSayisi: number })[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT c.*, COUNT(t.id) AS "listeSayisi"
     FROM categories c
     LEFT JOIN topics t ON t.category_id = c.id AND t.status = 'approved'
     GROUP BY c.id, c.slug, c.name, c.emoji, c.sort, c.aktif
     ORDER BY c.sort, c.id`
  )) as unknown as (Category & { aktif: number; listeSayisi: number })[];
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    sort: Number(r.sort),
    aktif: Number(r.aktif),
    listeSayisi: Number(r.listeSayisi),
  }));
}

export async function createCategory(ad: string, emoji: string) {
  await ensureInit();
  let s = slugify(ad);
  if (await get("SELECT 1 AS x FROM categories WHERE slug = ?", [s])) {
    s = `${s}-${randomUUID().slice(0, 4)}`;
  }
  const enBuyuk = (await get("SELECT COALESCE(MAX(sort), 0) AS n FROM categories")) as { n: number };
  await run("INSERT INTO categories (slug, name, emoji, sort, aktif) VALUES (?,?,?,?,1)", [
    s, ad, emoji, Number(enBuyuk?.n ?? 0) + 1,
  ]);
  return s;
}

export async function updateCategory(
  id: number,
  alanlar: { name?: string; emoji?: string; sort?: number; aktif?: number }
) {
  await ensureInit();
  const set: string[] = [];
  const deger: SqlValue[] = [];
  for (const [k, v] of Object.entries(alanlar)) {
    if (v === undefined) continue;
    set.push(`${k} = ?`);
    deger.push(v as SqlValue);
  }
  if (!set.length) return;
  deger.push(id);
  await run(`UPDATE categories SET ${set.join(", ")} WHERE id = ?`, deger);
}

/** Kategoriyi siler — yalnızca içinde liste yoksa. */
export async function deleteCategory(id: number): Promise<{ ok: boolean; sebep?: string }> {
  await ensureInit();
  const k = (await get("SELECT COUNT(*) AS n FROM topics WHERE category_id = ?", [id])) as { n: number };
  if (Number(k?.n ?? 0) > 0) {
    return { ok: false, sebep: `Bu kategoride ${k.n} liste var. Önce onları taşıyın ya da silin.` };
  }
  await run("DELETE FROM categories WHERE id = ?", [id]);
  return { ok: true };
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  await ensureInit();
  return (await get("SELECT * FROM categories WHERE slug = ?", [slug])) as unknown as Category | undefined;
}

export async function getTopicById(id: number): Promise<Topic | undefined> {
  await ensureInit();
  return (await get("SELECT * FROM topics WHERE id = ?", [id])) as unknown as Topic | undefined;
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

export type MenuItem = {
  id: number;
  name: string;
  topicSlug: string;
  topicTitle: string;
  categorySlug: string;
  city: string | null;
};

/** Arama kutusundaki blog sonuçları */
export type MenuYazi = { id: number; slug: string; baslik: string; ozet: string };

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
  yazilar: MenuYazi[];
  stats: SiteStats;
}> {
  await ensureInit();
  // Gizlenen kategoriler menüde görünmez
  const categories = (await getCategories())
    .filter((c) => Number((c as unknown as { aktif?: number }).aktif ?? 1) === 1)
    .map((c) => ({
      id: Number(c.id),
      slug: c.slug,
      name: c.name,
      emoji: c.emoji,
      sort: Number(c.sort),
    }));

  // menude = 0 olan listeler yönetici tarafından menüden gizlenmiştir
  const rows = (await all(
    `SELECT t.id, t.slug, t.title, t.city, c.slug AS "categorySlug",
            CAST(COALESCE(SUM(v.value * v.weight), 0) AS DOUBLE PRECISION) AS pop,
            COUNT(v.id) AS n
     FROM topics t
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN items i ON i.topic_id = t.id AND i.status IN ('active','candidate')
     LEFT JOIN votes v ON v.item_id = i.id
     WHERE t.status = 'approved' AND t.menude = 1 AND c.aktif = 1
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

  // Üst bar aramasının dizini: tüm aktif maddeler (kategori ve şehir süzgeci için
  // ait oldukları listenin bilgileriyle birlikte)
  const itemRows = (await all(
    `SELECT i.id, i.name, t.slug AS "topicSlug", t.title AS "topicTitle",
            c.slug AS "categorySlug", t.city
     FROM items i
     JOIN topics t ON t.id = i.topic_id
     JOIN categories c ON c.id = t.category_id
     WHERE i.status = 'active' AND t.status = 'approved'
     ORDER BY i.id`
  )) as unknown as MenuItem[];
  const items: MenuItem[] = itemRows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    topicSlug: r.topicSlug,
    topicTitle: r.topicTitle,
    categorySlug: r.categorySlug,
    city: r.city ?? null,
  }));

  const yaziRows = (await all(
    "SELECT id, slug, baslik, ozet FROM blog_posts WHERE durum = 'yayinda' ORDER BY created_at DESC LIMIT 100"
  )) as unknown as MenuYazi[];
  const yazilar: MenuYazi[] = yaziRows.map((y) => ({ ...y, id: Number(y.id) }));

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

  return { categories, topics, items, yazilar, stats };
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
  /** Yönetici hero'da öne çıkardı mı ve hangi sırada */
  oneCikan: number;
  heroSira: number;
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
    oneCikan: Number((t as unknown as { one_cikan?: number }).one_cikan ?? 0),
    heroSira: Number((t as unknown as { hero_sira?: number }).hero_sira ?? 0),
    items: (byTopic.get(Number(t.id)) ?? []).slice(0, perTopic),
  }));

  // Yönetici sıralaması önce: öne çıkanlar hero_sira'ya göre, kalanlar puana göre
  topics.sort(
    (a, b) =>
      b.oneCikan - a.oneCikan ||
      (a.oneCikan === 1 ? a.heroSira - b.heroSira : 0) ||
      b.popScore - a.popScore
  );

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
): Promise<{ top: ScoredItem[]; candidates: ScoredItem[]; rerankKisi: number }> {
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

  // Kişisel sıralamalar (yalnızca "tüm zamanlar" görünümünde puana katılır)
  const rerank =
    donem === "tum"
      ? await getRerankScores(topicId)
      : { puanlar: new Map<number, number>(), kisi: 0 };

  const scored = items.map((i) => {
    const a = agg.get(Number(i.id)) ?? BOS_PUAN;
    const rr = (rerank.puanlar.get(Number(i.id)) ?? 0) * RERANK_AGIRLIK;
    return {
      ...i,
      popScore: a.pop + rr,
      trendScore: a.trend,
      voteCount: a.count,
      rank: 0,
      delta: null as number | null,
    };
  });

  // Doğal sıra: puana göre. Yönetici bir maddeyi sabitlediyse (sabit=1) o madde
  // elle_sira konumuna yerleşir, kalanlar boşlukları puan sırasıyla doldurur.
  const dogal = scored
    .filter((i) => i.status === "active")
    .sort((a, b) => b.popScore - a.popScore || a.name.localeCompare(b.name, "tr"));

  const sabitler = dogal.filter(
    (i) => Number((i as unknown as { sabit?: number }).sabit ?? 0) === 1
  );
  const active: typeof dogal = [];
  if (sabitler.length) {
    const serbest = dogal.filter((i) => !sabitler.includes(i));
    const yerlesim = new Map<number, (typeof dogal)[0]>();
    for (const s of sabitler) {
      const konum = Number((s as unknown as { elle_sira?: number }).elle_sira ?? 0);
      if (konum >= 1 && !yerlesim.has(konum)) yerlesim.set(konum, s);
      else serbest.push(s); // geçersiz ya da çakışan konum: doğal akışa bırak
    }
    let sonraki = 0;
    for (let konum = 1; active.length < dogal.length; konum++) {
      const sabitOlan = yerlesim.get(konum);
      if (sabitOlan) active.push(sabitOlan);
      else if (sonraki < serbest.length) active.push(serbest[sonraki++]);
      else break;
    }
  } else {
    active.push(...dogal);
  }
  active.forEach((i, idx) => (i.rank = idx + 1));

  const candidates = scored
    .filter((i) => i.status === "candidate")
    .sort((a, b) => b.popScore - a.popScore);

  await applySnapshotDeltas(topicId, active);
  return { top: active.slice(0, 10), candidates, rerankKisi: rerank.kisi };
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
/**
 * Oy sahtekârlığı savunması.
 *
 * Tek bir çerezi silip sınırsız oy vermek mümkündü. Üç katman eklendi:
 *  1. Güven ağırlığı — yeni ziyaretçinin oyu yarım sayılır, çerez bir günü
 *     doldurduğunda tam ağırlığa çıkar. Çerez temizlemek artık kazandırmaz.
 *  2. Günlük tavan — kişi başına ve ağ (IP) başına.
 *  3. Hız freni — arka arkaya çok hızlı gelen oylar reddedilir.
 */
export const OY_SINIRLARI = {
  /** Misafirin günlük oy tavanı */
  misafirGunluk: 25,
  /** Üyenin günlük oy tavanı */
  uyeGunluk: 80,
  /** Aynı ağdan bir günde kaç farklı kimlik oy verebilir */
  ipGunlukKimlik: 8,
  /** İki oy arasındaki en kısa süre (saniye) */
  artArdaSaniye: 2,
  /** Misafir çerezi kaç saniye sonra tam ağırlığa çıkar */
  guvenSuresi: 24 * 3600,
} as const;

export type OyRedSebebi = "gunluk-sinir" | "ip-sinir" | "cok-hizli";

export type OySonuc = {
  ok: boolean;
  changed: boolean;
  /** Reddedildiyse sebebi */
  red?: OyRedSebebi;
  /** Oyun sonunda kaydedilen ağırlık (güven kesintisi uygulanmış olabilir) */
  agirlik?: number;
};

async function redSay(sebep: OyRedSebebi) {
  await run(
    `INSERT INTO vote_rejects (gun, sebep, adet) VALUES (?,?,1)
     ON CONFLICT (gun, sebep) DO UPDATE SET adet = vote_rejects.adet + 1`,
    [today(), sebep]
  );
}

/** Oy verenin ilk görülme zamanı ve toplam oy sayısı. */
async function oyProfili(voterKey: string): Promise<{ ilkGorulme: number; sonOy: number }> {
  const r = (await get(
    "SELECT ilk_gorulme, son_oy FROM voter_profile WHERE voter_key = ?",
    [voterKey]
  )) as { ilk_gorulme: number; son_oy: number } | undefined;

  if (r) return { ilkGorulme: Number(r.ilk_gorulme), sonOy: Number(r.son_oy) };

  await run(
    `INSERT INTO voter_profile (voter_key, ilk_gorulme, son_oy, oy_sayisi) VALUES (?,?,0,0)
     ON CONFLICT (voter_key) DO NOTHING`,
    [voterKey, nowSec()]
  );
  return { ilkGorulme: nowSec(), sonOy: 0 };
}

export async function castVote(opts: {
  itemId: number;
  voterKey: string;
  userId: number | null;
  value: 1 | -1;
  weight: number;
  /** Ağın günlük özeti; boş olabilir (yerel geliştirme, başlık yoksa) */
  ipGun?: string;
}): Promise<OySonuc> {
  await ensureInit();
  const gun = today();
  const simdi = nowSec();
  const uye = opts.userId !== null;

  const profil = await oyProfili(opts.voterKey);

  // 3. katman: hız freni
  if (profil.sonOy > 0 && simdi - profil.sonOy < OY_SINIRLARI.artArdaSaniye) {
    await redSay("cok-hizli");
    return { ok: false, changed: false, red: "cok-hizli" };
  }

  const mevcut = (await get(
    "SELECT id, value FROM votes WHERE item_id = ? AND voter_key = ? AND vote_date = ?",
    [opts.itemId, opts.voterKey, gun]
  )) as { id: number; value: number } | undefined;

  // 1. katman: güven ağırlığı. Üyelerde çerez yaşı rol oynamaz.
  const yeniZiyaretci = !uye && simdi - profil.ilkGorulme < OY_SINIRLARI.guvenSuresi;
  const agirlik = yeniZiyaretci ? opts.weight * 0.5 : opts.weight;

  // Fikir değiştirme yeni oy sayılmaz: tavan kontrolüne girmez
  if (mevcut) {
    if (Number(mevcut.value) === opts.value) return { ok: true, changed: false, agirlik };
    await run("UPDATE votes SET value = ?, weight = ?, created_at = ? WHERE id = ?", [
      opts.value, agirlik, simdi, Number(mevcut.id),
    ]);
    await run("UPDATE voter_profile SET son_oy = ? WHERE voter_key = ?", [simdi, opts.voterKey]);
    return { ok: true, changed: true, agirlik };
  }

  // 2. katman: günlük tavan (kişi)
  const gunluk = (await get(
    "SELECT COUNT(*) AS n FROM votes WHERE voter_key = ? AND vote_date = ?",
    [opts.voterKey, gun]
  )) as { n: number } | undefined;
  const tavan = uye ? OY_SINIRLARI.uyeGunluk : OY_SINIRLARI.misafirGunluk;
  if (Number(gunluk?.n ?? 0) >= tavan) {
    await redSay("gunluk-sinir");
    return { ok: false, changed: false, red: "gunluk-sinir" };
  }

  // 2. katman: günlük tavan (ağ) — çerez silerek kimlik tazelemeyi durdurur
  if (opts.ipGun) {
    const kimlikler = (await get(
      "SELECT COUNT(DISTINCT voter_key) AS n FROM votes WHERE ip_gun = ? AND vote_date = ?",
      [opts.ipGun, gun]
    )) as { n: number } | undefined;
    if (Number(kimlikler?.n ?? 0) >= OY_SINIRLARI.ipGunlukKimlik) {
      // Bu kimlik daha önce bu ağdan oy verdiyse zaten sayımın içindedir
      const tanidik = (await get(
        "SELECT 1 AS x FROM votes WHERE ip_gun = ? AND vote_date = ? AND voter_key = ? LIMIT 1",
        [opts.ipGun, gun, opts.voterKey]
      )) as { x: number } | undefined;
      if (!tanidik) {
        await redSay("ip-sinir");
        return { ok: false, changed: false, red: "ip-sinir" };
      }
    }
  }

  await run(
    `INSERT INTO votes (item_id, voter_key, user_id, value, weight, vote_date, ip_gun, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [opts.itemId, opts.voterKey, opts.userId, opts.value, agirlik, gun, opts.ipGun ?? "", simdi]
  );
  await run(
    "UPDATE voter_profile SET son_oy = ?, oy_sayisi = oy_sayisi + 1 WHERE voter_key = ?",
    [simdi, opts.voterKey]
  );
  return { ok: true, changed: true, agirlik };
}

/** Yönetim paneli: son N günün reddedilen oy sayaçları. */
export async function oyRedSayaclari(gunSayisi = 7): Promise<{ gun: string; sebep: string; adet: number }[]> {
  await ensureInit();
  const esik = new Date(Date.now() - gunSayisi * 86400_000).toISOString().slice(0, 10);
  return (await all(
    "SELECT gun, sebep, adet FROM vote_rejects WHERE gun >= ? ORDER BY gun DESC, adet DESC",
    [esik]
  )) as unknown as { gun: string; sebep: string; adet: number }[];
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
  /** null = sahipsiz (gündem taramasının açtığı otomatik taslaklar) */
  userId: number | null;
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

// ---- Web push abonelikleri ------------------------------------------------------

export type PushAbone = {
  id: number;
  user_id: number | null;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function pushAboneEkle(opts: {
  userId: number | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  await ensureInit();
  // Aynı cihaz yeniden abone olursa kaydı tazele (kullanıcı değişmiş olabilir)
  await run(
    `INSERT INTO push_abone (user_id, endpoint, p256dh, auth, created_at) VALUES (?,?,?,?,?)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = ?, p256dh = ?, auth = ?`,
    [
      opts.userId, opts.endpoint, opts.p256dh, opts.auth, nowSec(),
      opts.userId, opts.p256dh, opts.auth,
    ]
  );
}

export async function pushAboneSil(endpoint: string): Promise<void> {
  await ensureInit();
  await run("DELETE FROM push_abone WHERE endpoint = ?", [endpoint]);
}

export async function pushAboneleri(userId: number): Promise<PushAbone[]> {
  await ensureInit();
  return (await all("SELECT * FROM push_abone WHERE user_id = ?", [
    userId,
  ])) as unknown as PushAbone[];
}

/** Bir listeyi takip edenlerin tüm push abonelikleri. */
export async function takipcilerinPushAbonelikleri(topicId: number): Promise<PushAbone[]> {
  await ensureInit();
  return (await all(
    `SELECT p.* FROM push_abone p
     JOIN follows f ON f.user_id = p.user_id
     JOIN users u ON u.id = p.user_id
     WHERE f.topic_id = ? AND u.askida = 0`,
    [topicId]
  )) as unknown as PushAbone[];
}

// ---- Gündem taraması ----------------------------------------------------------

export type GundemKayit = {
  anahtar: string;
  baslik: string;
  sonuc: string;
  hedef: string;
  created_at: number;
};

/** Bu gündem başlığı daha önce işlendi mi? */
export async function gundemIslendiMi(anahtar: string): Promise<boolean> {
  await ensureInit();
  return !!(await get("SELECT 1 AS x FROM gundem_kayit WHERE anahtar = ?", [anahtar]));
}

export async function gundemKaydet(
  anahtar: string,
  baslik: string,
  sonuc: string,
  hedef = ""
): Promise<void> {
  await ensureInit();
  await run(
    `INSERT INTO gundem_kayit (anahtar, baslik, sonuc, hedef, created_at) VALUES (?,?,?,?,?)
     ON CONFLICT (anahtar) DO NOTHING`,
    [anahtar, baslik, sonuc, hedef, nowSec()]
  );
}

export async function gundemGecmisi(limit = 30): Promise<GundemKayit[]> {
  await ensureInit();
  return (await all(
    `SELECT * FROM gundem_kayit ORDER BY created_at DESC
     LIMIT ${Math.max(1, Math.min(100, limit))}`
  )) as unknown as GundemKayit[];
}

/** Eşleştirme için: yayındaki listelerin başlık/açıklama/şehir bilgisi. */
export async function gundemEslesmeVerisi(): Promise<{
  listeler: { id: number; title: string; description: string; city: string | null; categoryId: number }[];
  maddeAdlari: Set<string>;
}> {
  await ensureInit();
  const listeler = (await all(
    `SELECT id, title, description, city, category_id AS "categoryId"
     FROM topics WHERE status = 'approved'`
  )) as unknown as {
    id: number; title: string; description: string; city: string | null; categoryId: number;
  }[];

  const maddeler = (await all(
    "SELECT name FROM items WHERE status IN ('active','candidate','pending')"
  )) as unknown as { name: string }[];

  return {
    listeler: listeler.map((l) => ({ ...l, id: Number(l.id), categoryId: Number(l.categoryId) })),
    maddeAdlari: new Set(maddeler.map((m) => m.name.toLocaleLowerCase("tr"))),
  };
}

/** Gündemden gelen aday maddeyi listeye ekler (aday durumunda, oylanabilir). */
export async function gundemMaddesiEkle(topicId: number, ad: string): Promise<void> {
  await ensureInit();
  await run(
    "INSERT INTO items (topic_id, name, status, created_by, created_at) VALUES (?,?,'candidate',NULL,?)",
    [topicId, ad, nowSec()]
  );
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

export async function getAllApprovedTopics(): Promise<
  (Topic & { categoryName: string; categorySlug: string })[]
> {
  await ensureInit();
  return (await all(
    `SELECT t.*, c.name AS "categoryName", c.slug AS "categorySlug" FROM topics t
     JOIN categories c ON c.id = t.category_id
     WHERE t.status = 'approved' ORDER BY c.sort, t.title`
  )) as unknown as (Topic & { categoryName: string; categorySlug: string })[];
}

// ---- Yorumlar -----------------------------------------------------------------

export type Comment = {
  id: number;
  topic_id: number;
  user_id: number;
  body: string;
  status: "visible" | "hidden";
  created_at: number;
  username: string;
  role: "user" | "admin";
};

export const YORUM_MAX = 1000;

/** Bir başlığın görünür yorumları (eskiden yeniye). */
export async function getComments(topicId: number): Promise<Comment[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT c.id, c.topic_id, c.user_id, c.body, c.status, c.created_at,
            u.username, u.role
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.topic_id = ? AND c.status = 'visible'
     ORDER BY c.created_at`,
    [topicId]
  )) as unknown as Comment[];
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    topic_id: Number(r.topic_id),
    user_id: Number(r.user_id),
    created_at: Number(r.created_at),
  }));
}

/** Başlık başına görünür yorum sayıları (liste kartlarında göstermek için). */
export async function getCommentCounts(): Promise<Map<number, number>> {
  await ensureInit();
  const rows = (await all(
    `SELECT topic_id, COUNT(*) AS n FROM comments
     WHERE status = 'visible' GROUP BY topic_id`
  )) as unknown as { topic_id: number; n: number }[];
  return new Map(rows.map((r) => [Number(r.topic_id), Number(r.n)]));
}

export async function addComment(topicId: number, userId: number, body: string) {
  await ensureInit();
  await run(
    "INSERT INTO comments (topic_id, user_id, body, status, created_at) VALUES (?,?,?,'visible',?)",
    [topicId, userId, body.slice(0, YORUM_MAX), nowSec()]
  );
}

/** Yorumu gizler. Yalnızca yorum sahibi ya da yönetici çağırabilir (kontrol eylemde). */
export async function hideComment(commentId: number) {
  await ensureInit();
  await run("UPDATE comments SET status = 'hidden' WHERE id = ?", [commentId]);
}

export async function getCommentById(id: number): Promise<Comment | undefined> {
  await ensureInit();
  return (await get(
    `SELECT c.*, u.username, u.role FROM comments c
     JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [id]
  )) as unknown as Comment | undefined;
}

/** Yönetim paneli için son yorumlar. */
export async function getRecentComments(limit = 20): Promise<(Comment & { topicTitle: string; topicSlug: string })[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT c.id, c.topic_id, c.user_id, c.body, c.status, c.created_at,
            u.username, u.role, t.title AS "topicTitle", t.slug AS "topicSlug"
     FROM comments c
     JOIN users u ON u.id = c.user_id
     JOIN topics t ON t.id = c.topic_id
     WHERE c.status = 'visible'
     ORDER BY c.created_at DESC
     LIMIT ${Math.max(1, Math.min(100, limit))}`
  )) as unknown as (Comment & { topicTitle: string; topicSlug: string })[];
  return rows.map((r) => ({ ...r, id: Number(r.id), created_at: Number(r.created_at) }));
}

// ---- Yönetim: listeler ve maddeler -------------------------------------------------

export type YonetimListe = Topic & {
  categoryName: string;
  maddeSayisi: number;
  oySayisi: number;
  yorumSayisi: number;
  one_cikan: number;
  hero_sira: number;
  menude: number;
};

export async function getTopicsAdmin(): Promise<YonetimListe[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT t.*, c.name AS "categoryName",
            (SELECT COUNT(*) FROM items i WHERE i.topic_id = t.id AND i.status IN ('active','candidate')) AS "maddeSayisi",
            (SELECT COUNT(*) FROM votes v JOIN items i2 ON i2.id = v.item_id WHERE i2.topic_id = t.id) AS "oySayisi",
            (SELECT COUNT(*) FROM comments cm WHERE cm.topic_id = t.id AND cm.status = 'visible') AS "yorumSayisi"
     FROM topics t JOIN categories c ON c.id = t.category_id
     ORDER BY t.status, t.title`
  )) as unknown as YonetimListe[];
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    category_id: Number(r.category_id),
    maddeSayisi: Number(r.maddeSayisi),
    oySayisi: Number(r.oySayisi),
    yorumSayisi: Number(r.yorumSayisi),
    one_cikan: Number(r.one_cikan ?? 0),
    hero_sira: Number(r.hero_sira ?? 0),
    menude: Number(r.menude ?? 1),
  }));
}

export type YonetimMadde = Item & { sabit: number; elle_sira: number; oy: number };

/** Bir listenin tüm maddeleri (aday ve bekleyenler dahil) + oy sayıları. */
export async function getItemsAdmin(topicId: number): Promise<YonetimMadde[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT i.*, (SELECT COUNT(*) FROM votes v WHERE v.item_id = i.id) AS oy
     FROM items i WHERE i.topic_id = ?
     ORDER BY i.status, i.elle_sira, i.id`,
    [topicId]
  )) as unknown as YonetimMadde[];
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    topic_id: Number(r.topic_id),
    sabit: Number(r.sabit ?? 0),
    elle_sira: Number(r.elle_sira ?? 0),
    oy: Number(r.oy),
  }));
}

export async function updateTopic(
  id: number,
  alanlar: Partial<{
    title: string; description: string; category_id: number; city: string | null;
    status: string; one_cikan: number; hero_sira: number; menude: number;
  }>
) {
  await ensureInit();
  const set: string[] = [];
  const deger: SqlValue[] = [];
  for (const [k, v] of Object.entries(alanlar)) {
    if (v === undefined) continue;
    set.push(`${k} = ?`);
    deger.push(v as SqlValue);
  }
  if (!set.length) return;
  set.push("guncellendi = ?");
  deger.push(nowSec(), id);
  await run(`UPDATE topics SET ${set.join(", ")} WHERE id = ?`, deger);
}

/** Listeyi ve ona bağlı tüm kayıtları siler. */
export async function deleteTopic(id: number) {
  await ensureInit();
  await run("DELETE FROM duels WHERE topic_id = ?", [id]);
  await run("DELETE FROM reranks WHERE topic_id = ?", [id]);
  await run("DELETE FROM elo WHERE item_id IN (SELECT id FROM items WHERE topic_id = ?)", [id]);
  await run("DELETE FROM votes WHERE item_id IN (SELECT id FROM items WHERE topic_id = ?)", [id]);
  await run("DELETE FROM snapshots WHERE topic_id = ?", [id]);
  await run("DELETE FROM comments WHERE topic_id = ?", [id]);
  await run("DELETE FROM items WHERE topic_id = ?", [id]);
  await run("DELETE FROM topics WHERE id = ?", [id]);
}

export async function addItemAdmin(topicId: number, ad: string, durum = "active") {
  await ensureInit();
  await run(
    "INSERT INTO items (topic_id, name, status, created_by, created_at) VALUES (?,?,?,NULL,?)",
    [topicId, ad, durum, nowSec()]
  );
}

export async function updateItem(
  id: number,
  alanlar: Partial<{
    name: string; note: string; status: string; sabit: number; elle_sira: number;
    gorsel: string; site: string;
  }>
) {
  await ensureInit();
  const set: string[] = [];
  const deger: SqlValue[] = [];
  for (const [k, v] of Object.entries(alanlar)) {
    if (v === undefined) continue;
    set.push(`${k} = ?`);
    deger.push(v as SqlValue);
  }
  if (!set.length) return;
  deger.push(id);
  await run(`UPDATE items SET ${set.join(", ")} WHERE id = ?`, deger);
}

export async function deleteItem(id: number) {
  await ensureInit();
  await run("DELETE FROM votes WHERE item_id = ?", [id]);
  await run("DELETE FROM elo WHERE item_id = ?", [id]);
  await run("DELETE FROM snapshots WHERE item_id = ?", [id]);
  await run("DELETE FROM reranks WHERE item_id = ?", [id]);
  await run("DELETE FROM duels WHERE kazanan_id = ? OR kaybeden_id = ?", [id, id]);
  await run("DELETE FROM items WHERE id = ?", [id]);
}

// ---- Yönetim: üyeler -----------------------------------------------------------------

export type YonetimUye = {
  id: number;
  username: string;
  email: string;
  /** Boş değilse hesap Google ile bağlanmış */
  google_id: string;
  role: "user" | "admin";
  askida: number;
  created_at: number;
  oy: number;
  liste: number;
  yorum: number;
  duello: number;
};

export async function getUsersAdmin(): Promise<YonetimUye[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT u.id, u.username, u.email, u.google_id, u.role, u.askida, u.created_at,
            (SELECT COUNT(*) FROM votes v WHERE v.user_id = u.id) AS oy,
            (SELECT COUNT(*) FROM topics t WHERE t.created_by = u.id) AS liste,
            (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id AND c.status = 'visible') AS yorum,
            (SELECT COUNT(*) FROM duels d WHERE d.user_id = u.id) AS duello
     FROM users u ORDER BY u.created_at DESC`
  )) as unknown as YonetimUye[];
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    askida: Number(r.askida ?? 0),
    created_at: Number(r.created_at),
    oy: Number(r.oy),
    liste: Number(r.liste),
    yorum: Number(r.yorum),
    duello: Number(r.duello),
  }));
}

export async function updateUser(id: number, alanlar: { role?: string; askida?: number }) {
  await ensureInit();
  const set: string[] = [];
  const deger: SqlValue[] = [];
  for (const [k, v] of Object.entries(alanlar)) {
    if (v === undefined) continue;
    set.push(`${k} = ?`);
    deger.push(v as SqlValue);
  }
  if (!set.length) return;
  deger.push(id);
  await run(`UPDATE users SET ${set.join(", ")} WHERE id = ?`, deger);
}

/** Sitedeki toplam yönetici sayısı — son yöneticinin yetkisi alınmasın diye. */
export async function adminSayisi(): Promise<number> {
  await ensureInit();
  const r = (await get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")) as { n: number };
  return Number(r?.n ?? 0);
}

/** Tüm üyelere duyuru bildirimi gönderir. */
export async function duyuruGonder(mesaj: string, link: string): Promise<number> {
  await ensureInit();
  const uyeler = (await all("SELECT id FROM users WHERE askida = 0")) as unknown as { id: number }[];
  const satirlar: SqlValue[][] = uyeler.map((u) => [Number(u.id), mesaj, link, 0, nowSec()]);
  await insertMany("notifications", ["user_id", "body", "link", "okundu", "created_at"], satirlar);
  return satirlar.length;
}

// ---- Blog ---------------------------------------------------------------------------

export type BlogYazi = {
  id: number;
  slug: string;
  baslik: string;
  ozet: string;
  icerik: string;
  kapak: string;
  durum: "taslak" | "yayinda";
  yazar_id: number | null;
  goruntulenme: number;
  created_at: number;
  updated_at: number;
  yazar?: string | null;
};

function blogDuzelt(r: BlogYazi): BlogYazi {
  return {
    ...r,
    id: Number(r.id),
    goruntulenme: Number(r.goruntulenme),
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
  };
}

export async function getBlogYazilariAdmin(): Promise<BlogYazi[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT b.*, u.username AS yazar FROM blog_posts b
     LEFT JOIN users u ON u.id = b.yazar_id
     ORDER BY b.created_at DESC`
  )) as unknown as BlogYazi[];
  return rows.map(blogDuzelt);
}

export async function getYayindakiYazilar(limit = 50): Promise<BlogYazi[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT b.*, u.username AS yazar FROM blog_posts b
     LEFT JOIN users u ON u.id = b.yazar_id
     WHERE b.durum = 'yayinda'
     ORDER BY b.created_at DESC LIMIT ${Math.max(1, Math.min(200, limit))}`
  )) as unknown as BlogYazi[];
  return rows.map(blogDuzelt);
}

export async function getBlogYazi(slug: string): Promise<BlogYazi | undefined> {
  await ensureInit();
  const r = (await get(
    `SELECT b.*, u.username AS yazar FROM blog_posts b
     LEFT JOIN users u ON u.id = b.yazar_id WHERE b.slug = ?`,
    [slug]
  )) as unknown as BlogYazi | undefined;
  return r ? blogDuzelt(r) : undefined;
}

export async function getBlogYaziById(id: number): Promise<BlogYazi | undefined> {
  await ensureInit();
  const r = (await get("SELECT * FROM blog_posts WHERE id = ?", [id])) as unknown as
    | BlogYazi
    | undefined;
  return r ? blogDuzelt(r) : undefined;
}

export async function createBlogYazi(baslik: string, yazarId: number): Promise<number> {
  await ensureInit();
  let s = slugify(baslik);
  if (!s) s = `yazi-${randomUUID().slice(0, 6)}`;
  if (await get("SELECT 1 AS x FROM blog_posts WHERE slug = ?", [s])) {
    s = `${s}-${randomUUID().slice(0, 4)}`;
  }
  const r = (await get(
    `INSERT INTO blog_posts (slug, baslik, ozet, icerik, kapak, durum, yazar_id, created_at, updated_at)
     VALUES (?,?,'','','','taslak',?,?,?) RETURNING id`,
    [s, baslik, yazarId, nowSec(), nowSec()]
  )) as { id: number };
  return Number(r.id);
}

export async function updateBlogYazi(
  id: number,
  alanlar: Partial<{ baslik: string; ozet: string; icerik: string; kapak: string; durum: string; slug: string }>
) {
  await ensureInit();
  const set: string[] = [];
  const deger: SqlValue[] = [];
  for (const [k, v] of Object.entries(alanlar)) {
    if (v === undefined) continue;
    set.push(`${k} = ?`);
    deger.push(v as SqlValue);
  }
  if (!set.length) return;
  set.push("updated_at = ?");
  deger.push(nowSec(), id);
  await run(`UPDATE blog_posts SET ${set.join(", ")} WHERE id = ?`, deger);
}

export async function deleteBlogYazi(id: number) {
  await ensureInit();
  await run("DELETE FROM blog_posts WHERE id = ?", [id]);
}

export async function blogGoruntulendi(id: number) {
  await ensureInit();
  await run("UPDATE blog_posts SET goruntulenme = goruntulenme + 1 WHERE id = ?", [id]);
}

// ---- Ayarlar, denetim kaydı ve olay takibi ----------------------------------------

export async function getSetting(key: string, varsayilan = ""): Promise<string> {
  await ensureInit();
  const r = (await get("SELECT value FROM settings WHERE key = ?", [key])) as
    | { value: string }
    | undefined;
  return r?.value ?? varsayilan;
}

export async function getSettings(): Promise<Record<string, string>> {
  await ensureInit();
  const rows = (await all("SELECT key, value FROM settings")) as unknown as {
    key: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Özellik anahtarı açık mı? Ayarlar panelindeki onay kutuları "on" değeri
 * gönderir; hiç kaydedilmemişse özellik varsayılan olarak açıktır.
 */
export async function ozellikAcik(key: string): Promise<boolean> {
  const d = await getSetting(key, "on");
  return d === "on" || d === "1";
}

export async function setSetting(key: string, value: string) {
  await ensureInit();
  await run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
     ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = ?`,
    [key, value, nowSec(), value, nowSec()]
  );
}

/** Yönetici işlemlerini kaydeder — kim, neyi, ne zaman değiştirdi. */
export async function denetimKaydi(
  userId: number | null,
  username: string,
  eylem: string,
  hedef: string,
  detay = ""
) {
  await ensureInit();
  await run(
    "INSERT INTO audit_log (user_id, username, eylem, hedef, detay, created_at) VALUES (?,?,?,?,?,?)",
    [userId, username, eylem, hedef, detay.slice(0, 500), nowSec()]
  );
}

export type DenetimSatiri = {
  id: number; username: string; eylem: string; hedef: string; detay: string; created_at: number;
};

export async function getDenetimKayitlari(limit = 50): Promise<DenetimSatiri[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT id, username, eylem, hedef, detay, created_at FROM audit_log
     ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(200, limit))}`
  )) as unknown as DenetimSatiri[];
  return rows.map((r) => ({ ...r, id: Number(r.id), created_at: Number(r.created_at) }));
}

export type IstatistikOzet = {
  gunluk: { gun: string; goruntuleme: number; tiklama: number }[];
  enCokSayfa: { yol: string; n: number }[];
  enCokTiklama: { hedef: string; n: number }[];
  toplamGoruntuleme: number;
  toplamTiklama: number;
  tekilZiyaretci: number;
};

/** Son N günün görüntüleme ve tıklama özeti. */
export async function getIstatistik(gun = 14): Promise<IstatistikOzet> {
  await ensureInit();
  const bas = new Date(Date.now() - gun * 86400_000).toISOString().slice(0, 10);

  const gunluk = (await all(
    `SELECT gun,
            SUM(CASE WHEN tur = 'goruntuleme' THEN 1 ELSE 0 END) AS goruntuleme,
            SUM(CASE WHEN tur = 'tiklama' THEN 1 ELSE 0 END) AS tiklama
     FROM events WHERE gun >= ? GROUP BY gun ORDER BY gun`,
    [bas]
  )) as unknown as { gun: string; goruntuleme: number; tiklama: number }[];

  const enCokSayfa = (await all(
    `SELECT yol, COUNT(*) AS n FROM events
     WHERE tur = 'goruntuleme' AND gun >= ? AND yol <> ''
     GROUP BY yol ORDER BY COUNT(*) DESC LIMIT 12`,
    [bas]
  )) as unknown as { yol: string; n: number }[];

  const enCokTiklama = (await all(
    `SELECT hedef, COUNT(*) AS n FROM events
     WHERE tur = 'tiklama' AND gun >= ? AND hedef <> ''
     GROUP BY hedef ORDER BY COUNT(*) DESC LIMIT 12`,
    [bas]
  )) as unknown as { hedef: string; n: number }[];

  const t = (await get(
    `SELECT SUM(CASE WHEN tur = 'goruntuleme' THEN 1 ELSE 0 END) AS g,
            SUM(CASE WHEN tur = 'tiklama' THEN 1 ELSE 0 END) AS t,
            COUNT(DISTINCT voter_key) AS z
     FROM events WHERE gun >= ?`,
    [bas]
  )) as unknown as { g: number; t: number; z: number };

  return {
    gunluk: gunluk.map((r) => ({
      gun: r.gun,
      goruntuleme: Number(r.goruntuleme),
      tiklama: Number(r.tiklama),
    })),
    enCokSayfa: enCokSayfa.map((r) => ({ yol: r.yol, n: Number(r.n) })),
    enCokTiklama: enCokTiklama.map((r) => ({ hedef: r.hedef, n: Number(r.n) })),
    toplamGoruntuleme: Number(t?.g ?? 0),
    toplamTiklama: Number(t?.t ?? 0),
    tekilZiyaretci: Number(t?.z ?? 0),
  };
}

/** Sayfa görüntüleme / tıklama gibi olayları kaydeder. */
export async function olayKaydet(tur: string, yol: string, hedef = "", voterKey = "") {
  await ensureInit();
  await run(
    "INSERT INTO events (tur, yol, hedef, voter_key, gun, created_at) VALUES (?,?,?,?,?,?)",
    [tur, yol.slice(0, 200), hedef.slice(0, 200), voterKey, today(), nowSec()]
  );
}

// ---- İkili karşılaştırma (düello) + Elo -------------------------------------------

/**
 * LMArena/Ranker modeli: "A mı B mi?" sorusu tek oydan daha çok bilgi taşır ve
 * manipülasyona daha dirençlidir. Sonuçlar Elo ile birikir.
 *
 * K katsayısı sinyalin gücünü belirler: üye maçları misafirden ağır sayılır
 * (üye oyu ×2 ilkesiyle tutarlı).
 */
const ELO_BASLANGIC = 1500;
const K_UYE = 32;
const K_MISAFIR = 16;

/** Bir kişinin bir başlıkta günde yapabileceği düello sayısı. */
export const GUNLUK_DUELLO_SINIRI = 20;

export type EloKaydi = { puan: number; mac: number };

export async function getEloMap(topicId: number): Promise<Map<number, EloKaydi>> {
  await ensureInit();
  const rows = (await all(
    `SELECT e.item_id, e.puan, e.mac FROM elo e
     JOIN items i ON i.id = e.item_id
     WHERE i.topic_id = ?`,
    [topicId]
  )) as unknown as { item_id: number; puan: number; mac: number }[];
  return new Map(rows.map((r) => [Number(r.item_id), { puan: Number(r.puan), mac: Number(r.mac) }]));
}

async function eloOku(itemId: number): Promise<EloKaydi> {
  const r = (await get("SELECT puan, mac FROM elo WHERE item_id = ?", [itemId])) as
    | { puan: number; mac: number }
    | undefined;
  return r ? { puan: Number(r.puan), mac: Number(r.mac) } : { puan: ELO_BASLANGIC, mac: 0 };
}

async function eloYaz(itemId: number, puan: number, mac: number) {
  await run(
    `INSERT INTO elo (item_id, puan, mac) VALUES (?,?,?)
     ON CONFLICT (item_id) DO UPDATE SET puan = ?, mac = ?`,
    [itemId, Math.round(puan), mac, Math.round(puan), mac]
  );
}

/** Bugün bu başlıkta kaç düello yapıldı (sınır kontrolü için). */
export async function getDuelloSayisi(topicId: number, voterKey: string): Promise<number> {
  await ensureInit();
  const r = (await get(
    "SELECT COUNT(*) AS n FROM duels WHERE topic_id = ? AND voter_key = ? AND duel_date = ?",
    [topicId, voterKey, today()]
  )) as unknown as { n: number };
  return Number(r?.n ?? 0);
}

/** Düello sonucunu kaydeder ve iki maddenin Elo puanını günceller. */
export async function recordDuel(opts: {
  topicId: number;
  kazananId: number;
  kaybedenId: number;
  voterKey: string;
  userId: number | null;
}): Promise<{ ok: boolean; kazananPuan: number; kaybedenPuan: number }> {
  await ensureInit();
  const a = await eloOku(opts.kazananId);
  const b = await eloOku(opts.kaybedenId);

  // Beklenen skor: puan farkı 400 ise güçlü olanın kazanma beklentisi ~%91
  const beklenenA = 1 / (1 + Math.pow(10, (b.puan - a.puan) / 400));
  const beklenenB = 1 - beklenenA;
  const K = opts.userId ? K_UYE : K_MISAFIR;

  const yeniA = a.puan + K * (1 - beklenenA);
  const yeniB = b.puan + K * (0 - beklenenB);

  await eloYaz(opts.kazananId, yeniA, a.mac + 1);
  await eloYaz(opts.kaybedenId, yeniB, b.mac + 1);

  await run(
    `INSERT INTO duels (topic_id, kazanan_id, kaybeden_id, voter_key, user_id, duel_date, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [opts.topicId, opts.kazananId, opts.kaybedenId, opts.voterKey, opts.userId, today(), nowSec()]
  );

  return { ok: true, kazananPuan: Math.round(yeniA), kaybedenPuan: Math.round(yeniB) };
}

// ---- Kişisel sıralama (re-rank) ---------------------------------------------------

/**
 * Ranker modeli: üyenin kendi sıralaması normal oydan daha ağır sayılır.
 * Üye listeyi baştan dizmek için emek harcadığından sinyali daha güçlüdür.
 *
 * Katkı = (toplam_madde − sıra + 1) × RERANK_AGIRLIK. 10 maddelik bir listede
 * ilk sıraya koymak 10 puan, yani beş üye oyu (2 puan) değerinde; son sıraya
 * koymak 1 puan. Ağırlık 1'de bırakıldı — daha yükseği tek kişinin sıralamasını
 * onlarca oyun önüne geçiriyordu.
 *
 * Yalnızca "Popüler" puanına eklenir; "Yükselenler" zaman çürümesine dayandığı
 * için sabit katkı oraya karıştırılmaz.
 */
export const RERANK_AGIRLIK = 1;

/** Üyenin bir başlık için kaydettiği sıralama (madde kimlikleri, sırayla). */
export async function getMyRerank(userId: number, topicId: number): Promise<number[]> {
  await ensureInit();
  const rows = (await all(
    "SELECT item_id FROM reranks WHERE user_id = ? AND topic_id = ? ORDER BY position",
    [userId, topicId]
  )) as unknown as { item_id: number }[];
  return rows.map((r) => Number(r.item_id));
}

/** Üyenin sıralamasını kaydeder (öncekini değiştirir). */
export async function saveRerank(userId: number, topicId: number, itemIds: number[]) {
  await ensureInit();
  await run("DELETE FROM reranks WHERE user_id = ? AND topic_id = ?", [userId, topicId]);
  if (itemIds.length === 0) return;
  const toplam = itemIds.length;
  const rows: SqlValue[][] = itemIds.map((id, idx) => [
    userId, topicId, id, idx + 1, toplam - idx, nowSec(),
  ]);
  await insertMany(
    "reranks",
    ["user_id", "topic_id", "item_id", "position", "puan", "created_at"],
    rows
  );
}

/**
 * Uyum skoru: kişisel sıralamanın topluluk sıralamasına ne kadar yakın olduğu.
 *
 * Sıra farklarının ortalaması alınıp normalleştirilir (Spearman ayak izi).
 * n maddede iki sıralama arasındaki ortalama mutlak fark en kötü durumda
 * yaklaşık n/2'dir; skoru 0–100 aralığına buradan çeviriyoruz.
 *   100 = birebir aynı, 0 = tam ters.
 */
export function uyumSkoru(kisisel: number[], topluluk: number[]): number | null {
  const ortak = kisisel.filter((id) => topluluk.includes(id));
  if (ortak.length < 3) return null; // 3 maddenin altında anlamlı değil

  const kSira = new Map(ortak.map((id) => [id, kisisel.indexOf(id)]));
  const tSira = new Map(ortak.map((id) => [id, topluluk.indexOf(id)]));

  // Ortak maddeleri kendi içinde 0..n-1 olarak yeniden numaralandır
  const kDizi = [...ortak].sort((a, b) => kSira.get(a)! - kSira.get(b)!);
  const tDizi = [...ortak].sort((a, b) => tSira.get(a)! - tSira.get(b)!);
  const kIdx = new Map(kDizi.map((id, i) => [id, i]));
  const tIdx = new Map(tDizi.map((id, i) => [id, i]));

  const n = ortak.length;
  const toplamFark = ortak.reduce((s, id) => s + Math.abs(kIdx.get(id)! - tIdx.get(id)!), 0);
  const enKotu = Math.floor(n * n / 2); // ters sıralamada oluşan toplam fark
  const oran = enKotu === 0 ? 0 : toplamFark / enKotu;
  return Math.max(0, Math.min(100, Math.round((1 - oran) * 100)));
}

/** Üyenin tüm listelerdeki ortalama uyum skoru (profil sayfası için). */
export async function uyeUyumOzeti(
  userId: number
): Promise<{ ortalama: number | null; listeSayisi: number }> {
  await ensureInit();
  const topicIdler = (await all(
    "SELECT DISTINCT topic_id FROM reranks WHERE user_id = ?",
    [userId]
  )) as unknown as { topic_id: number }[];

  const skorlar: number[] = [];
  for (const t of topicIdler) {
    const topicId = Number(t.topic_id);
    const kisisel = await getMyRerank(userId, topicId);
    const { top } = await getTopicBoard(topicId);
    const skor = uyumSkoru(kisisel, top.map((i) => Number(i.id)));
    if (skor !== null) skorlar.push(skor);
  }

  if (!skorlar.length) return { ortalama: null, listeSayisi: topicIdler.length };
  return {
    ortalama: Math.round(skorlar.reduce((a, b) => a + b, 0) / skorlar.length),
    listeSayisi: skorlar.length,
  };
}

/** Başlıktaki maddelerin toplam kişisel sıralama puanı ve kaç kişinin sıraladığı. */
async function getRerankScores(
  topicId: number
): Promise<{ puanlar: Map<number, number>; kisi: number }> {
  const rows = (await all(
    `SELECT item_id, CAST(SUM(puan) AS DOUBLE PRECISION) AS pts
     FROM reranks WHERE topic_id = ? GROUP BY item_id`,
    [topicId]
  )) as unknown as { item_id: number; pts: number }[];
  const k = (await get(
    "SELECT COUNT(DISTINCT user_id) AS n FROM reranks WHERE topic_id = ?",
    [topicId]
  )) as unknown as { n: number };
  return {
    puanlar: new Map(rows.map((r) => [Number(r.item_id), Number(r.pts) || 0])),
    kisi: Number(k?.n ?? 0),
  };
}

// ---- Oy yakınlığı ("bunu oylayan şunu da oyladı") ---------------------------------

export type YakinMadde = {
  itemId: number;
  name: string;
  topicSlug: string;
  topicTitle: string;
  ortakOylayan: number;
};

/**
 * Bu başlıktaki maddelere olumlu oy verenlerin, BAŞKA başlıklarda
 * en çok olumlu oy verdiği maddeler. Ranker'ın "tat grafiği" fikrinin
 * tek sorguluk basit hali.
 */
export async function getCoVotedItems(topicId: number, limit = 6): Promise<YakinMadde[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT d.id AS "itemId", d.name, t.slug AS "topicSlug", t.title AS "topicTitle",
            COUNT(DISTINCT v2.voter_key) AS "ortakOylayan"
     FROM votes v1
     JOIN items i1 ON i1.id = v1.item_id
     JOIN votes v2 ON v2.voter_key = v1.voter_key AND v2.value = 1
     JOIN items d ON d.id = v2.item_id AND d.status = 'active'
     JOIN topics t ON t.id = d.topic_id AND t.status = 'approved'
     WHERE i1.topic_id = ? AND v1.value = 1 AND d.topic_id <> ?
     GROUP BY d.id, d.name, t.slug, t.title
     HAVING COUNT(DISTINCT v2.voter_key) >= 2
     ORDER BY COUNT(DISTINCT v2.voter_key) DESC
     LIMIT ${Math.max(1, Math.min(20, limit))}`,
    [topicId, topicId]
  )) as unknown as YakinMadde[];
  return rows.map((r) => ({ ...r, itemId: Number(r.itemId), ortakOylayan: Number(r.ortakOylayan) }));
}

// ---- Şehirler ------------------------------------------------------------------------

export type SehirOzet = { sehir: string; slug: string; listeSayisi: number; oySayisi: number };

/** Şehir etiketi olan tüm listelerin şehir bazında özeti. */
export async function getSehirler(): Promise<SehirOzet[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT t.city AS sehir, COUNT(DISTINCT t.id) AS "listeSayisi", COUNT(v.id) AS "oySayisi"
     FROM topics t
     LEFT JOIN items i ON i.topic_id = t.id AND i.status IN ('active','candidate')
     LEFT JOIN votes v ON v.item_id = i.id
     WHERE t.status = 'approved' AND t.city IS NOT NULL AND t.city <> ''
     GROUP BY t.city
     ORDER BY COUNT(DISTINCT t.id) DESC, t.city`
  )) as unknown as { sehir: string; listeSayisi: number; oySayisi: number }[];
  return rows.map((r) => ({
    sehir: r.sehir,
    slug: slugify(r.sehir),
    listeSayisi: Number(r.listeSayisi),
    oySayisi: Number(r.oySayisi),
  }));
}

/** Bir şehrin adı (slug'dan) ve o şehirdeki listeler. */
export async function getSehirDetay(
  slug: string
): Promise<{ sehir: string; listeler: TopicSummary[] } | undefined> {
  const hepsi = await getSehirler();
  const bulunan = hepsi.find((s) => s.slug === slug);
  if (!bulunan) return undefined;
  const tumListeler = await getTopicSummaries();
  return {
    sehir: bulunan.sehir,
    listeler: tumListeler
      .filter((t) => t.city === bulunan.sehir)
      .sort((a, b) => b.popScore - a.popScore),
  };
}

// ---- Takip ve momentum uyarıları -----------------------------------------------------

export async function takipEdiyorMu(userId: number, topicId: number): Promise<boolean> {
  await ensureInit();
  const r = await get("SELECT 1 AS x FROM follows WHERE user_id = ? AND topic_id = ?", [
    userId,
    topicId,
  ]);
  return !!r;
}

export async function takipDegistir(userId: number, topicId: number): Promise<boolean> {
  await ensureInit();
  if (await takipEdiyorMu(userId, topicId)) {
    await run("DELETE FROM follows WHERE user_id = ? AND topic_id = ?", [userId, topicId]);
    return false;
  }
  await run("INSERT INTO follows (user_id, topic_id, created_at) VALUES (?,?,?)", [
    userId,
    topicId,
    nowSec(),
  ]);
  return true;
}

export async function getTakipSayisi(topicId: number): Promise<number> {
  await ensureInit();
  const r = (await get("SELECT COUNT(*) AS n FROM follows WHERE topic_id = ?", [topicId])) as {
    n: number;
  };
  return Number(r?.n ?? 0);
}

/**
 * Takip edilen listelerde dünden bugüne sıra değişimlerini bulur ve takipçilere
 * bildirim düşer. Tembel çalışır: liste görüntülendiğinde tetiklenir ve gün
 * başına bir kez bildirim gönderir (son_bildirim alanı bunu güvence altına alır).
 */
export async function momentumBildirimleri(topicId: number): Promise<number> {
  await ensureInit();
  const bugun = today();

  const takipciler = (await all(
    "SELECT user_id FROM follows WHERE topic_id = ? AND son_bildirim <> ?",
    [topicId, bugun]
  )) as unknown as { user_id: number }[];
  if (takipciler.length === 0) return 0;

  const oncekiGun = (await get(
    "SELECT MAX(snap_date) AS d FROM snapshots WHERE topic_id = ? AND snap_date < ?",
    [topicId, bugun]
  )) as { d: string | null } | undefined;
  if (!oncekiGun?.d) return 0;

  const satirlar = (await all(
    `SELECT s.item_id, s.rank, s.snap_date, i.name, t.title, t.slug
     FROM snapshots s JOIN items i ON i.id = s.item_id JOIN topics t ON t.id = s.topic_id
     WHERE s.topic_id = ? AND s.snap_date IN (?, ?)`,
    [topicId, oncekiGun.d, bugun]
  )) as unknown as {
    item_id: number; rank: number; snap_date: string; name: string; title: string; slug: string;
  }[];

  const dun = new Map<number, number>();
  const bu = new Map<number, { rank: number; name: string; title: string; slug: string }>();
  for (const s of satirlar) {
    if (s.snap_date === oncekiGun.d) dun.set(Number(s.item_id), Number(s.rank));
    else bu.set(Number(s.item_id), { rank: Number(s.rank), name: s.name, title: s.title, slug: s.slug });
  }

  // En büyük sıçramayı bul (en az 2 sıra)
  let enBuyuk: { fark: number; ad: string; title: string; slug: string; sira: number } | null = null;
  for (const [itemId, simdiki] of bu) {
    const eski = dun.get(itemId);
    if (eski === undefined) continue;
    const fark = eski - simdiki.rank;
    if (fark >= 2 && (!enBuyuk || fark > enBuyuk.fark)) {
      enBuyuk = { fark, ad: simdiki.name, title: simdiki.title, slug: simdiki.slug, sira: simdiki.rank };
    }
  }
  if (!enBuyuk) return 0;

  const mesaj = `${enBuyuk.ad} ${enBuyuk.fark} sıra yükselerek ${enBuyuk.sira}. sıraya çıktı — ${enBuyuk.title}`;
  const link = `/liste/${enBuyuk.slug}`;
  for (const t of takipciler) {
    await addNotification(Number(t.user_id), mesaj, link);
  }
  await run("UPDATE follows SET son_bildirim = ? WHERE topic_id = ?", [bugun, topicId]);

  // Aynı uyarı push olarak da gitsin. İstek yolunu bekletmemek için
  // beklenmiyor; push yapılandırılmamışsa çağrı hemen geri döner.
  void (async () => {
    try {
      const { pushAcikMi, pushGonder } = await import("./push");
      if (!pushAcikMi()) return;
      const aboneler = await takipcilerinPushAbonelikleri(topicId);
      await pushGonder(aboneler, {
        baslik: `📈 ${enBuyuk!.title}`,
        govde: `${enBuyuk!.ad} ${enBuyuk!.fark} sıra yükseldi — artık ${enBuyuk!.sira}. sırada.`,
        yol: link,
        etiket: `momentum-${topicId}`,
      });
    } catch (e) {
      hataBildir(e, { nerede: "push:momentum", ek: { topicId } });
    }
  })();

  return takipciler.length;
}

// ---- Haftalık özet ------------------------------------------------------------------

export type HaftalikOzet = {
  hafta: string;
  baslangic: string;
  bitis: string;
  sayilar: { oy: number; duello: number; yorum: number; yeniUye: number; tahmin: number };
  zirveDegisenler: { topicTitle: string; topicSlug: string; yeni: string; eski: string }[];
  yukselenler: { ad: string; topicTitle: string; topicSlug: string; itemId: number; fark: number; yeniSira: number }[];
  enHareketliListeler: { title: string; slug: string; oy: number }[];
  veriYeterli: boolean;
};

/**
 * Bu haftanın özeti: zirve değişimleri, en hızlı yükselenler ve hafta sayaçları.
 * Sıra karşılaştırması `snapshots` tablosundaki günlük kayıtlara dayanır;
 * yeterli geçmiş yoksa veriYeterli=false döner.
 */
export async function getHaftalikOzet(): Promise<HaftalikOzet> {
  await ensureInit();
  const simdi = nowSec();
  const [baslangic, bitis] = weekRange(simdi);
  const haftaBasi = baslangic;
  const bugun = today();

  const sayilarRow = (await get(
    `SELECT (SELECT COUNT(*) FROM votes WHERE vote_date >= ?) AS oy,
            (SELECT COUNT(*) FROM duels WHERE duel_date >= ?) AS duello,
            (SELECT COUNT(*) FROM comments WHERE created_at >= ? AND status = 'visible') AS yorum,
            (SELECT COUNT(*) FROM users WHERE created_at >= ?) AS yeniUye,
            (SELECT COUNT(*) FROM predictions WHERE hafta = ?) AS tahmin`,
    [haftaBasi, haftaBasi, simdi - 7 * 86400, simdi - 7 * 86400, currentWeekKey()]
  )) as unknown as Record<string, number>;

  // Hafta başındaki ve bugünkü sıralar
  const snaplar = (await all(
    `SELECT s.topic_id, s.item_id, s.rank, s.snap_date, i.name, t.title, t.slug
     FROM snapshots s
     JOIN items i ON i.id = s.item_id
     JOIN topics t ON t.id = s.topic_id
     WHERE s.snap_date IN (?, ?) AND t.status = 'approved'`,
    [haftaBasi, bugun]
  )) as unknown as {
    topic_id: number; item_id: number; rank: number; snap_date: string;
    name: string; title: string; slug: string;
  }[];

  const basta = new Map<string, (typeof snaplar)[0]>();
  const simdiki = new Map<string, (typeof snaplar)[0]>();
  for (const s of snaplar) {
    const anahtar = `${s.topic_id}|${s.item_id}`;
    if (s.snap_date === haftaBasi) basta.set(anahtar, s);
    else simdiki.set(anahtar, s);
  }

  const yukselenler: HaftalikOzet["yukselenler"] = [];
  const zirveDegisenler: HaftalikOzet["zirveDegisenler"] = [];
  const bastakiLider = new Map<number, string>();
  const simdikiLider = new Map<number, { ad: string; title: string; slug: string }>();

  for (const [anahtar, s] of simdiki) {
    const eski = basta.get(anahtar);
    if (eski) {
      const fark = Number(eski.rank) - Number(s.rank);
      if (fark > 0) {
        yukselenler.push({
          ad: s.name,
          topicTitle: s.title,
          topicSlug: s.slug,
          itemId: Number(s.item_id),
          fark,
          yeniSira: Number(s.rank),
        });
      }
    }
    if (Number(s.rank) === 1) {
      simdikiLider.set(Number(s.topic_id), { ad: s.name, title: s.title, slug: s.slug });
    }
  }
  for (const s of basta.values()) {
    if (Number(s.rank) === 1) bastakiLider.set(Number(s.topic_id), s.name);
  }
  for (const [topicId, yeni] of simdikiLider) {
    const eski = bastakiLider.get(topicId);
    if (eski && eski !== yeni.ad) {
      zirveDegisenler.push({
        topicTitle: yeni.title,
        topicSlug: yeni.slug,
        yeni: yeni.ad,
        eski,
      });
    }
  }
  yukselenler.sort((a, b) => b.fark - a.fark || a.yeniSira - b.yeniSira);

  const enHareketli = (await all(
    `SELECT t.title, t.slug, COUNT(v.id) AS oy
     FROM votes v JOIN items i ON i.id = v.item_id JOIN topics t ON t.id = i.topic_id
     WHERE v.vote_date >= ? AND t.status = 'approved'
     GROUP BY t.id, t.title, t.slug ORDER BY COUNT(v.id) DESC LIMIT 5`,
    [haftaBasi]
  )) as unknown as { title: string; slug: string; oy: number }[];

  return {
    hafta: currentWeekKey(),
    baslangic,
    bitis,
    sayilar: {
      oy: Number(sayilarRow?.oy ?? 0),
      duello: Number(sayilarRow?.duello ?? 0),
      yorum: Number(sayilarRow?.yorum ?? 0),
      yeniUye: Number(sayilarRow?.yeniUye ?? 0),
      tahmin: Number(sayilarRow?.tahmin ?? 0),
    },
    zirveDegisenler,
    yukselenler: yukselenler.slice(0, 8),
    enHareketliListeler: enHareketli.map((r) => ({ ...r, oy: Number(r.oy) })),
    veriYeterli: basta.size > 0 && simdiki.size > 0,
  };
}

// ---- Tahmin oyunu -------------------------------------------------------------------

export type Tahmin = {
  id: number;
  topic_id: number;
  item_id: number;
  hafta: string;
  sonuc: "bekliyor" | "dogru" | "yanlis";
  itemAdi?: string;
  topicTitle?: string;
  topicSlug?: string;
};

/**
 * Tembel puanlama: süresi dolmuş tahminler ilk görüntülemede sonuçlanır.
 * Zamanlanmış görev (cron) gerektirmez — sonuç aynı, yalnızca hesaplama anı
 * ilk bakışa ertelenir.
 */
export async function bekleyenTahminleriSonuclandir(): Promise<number> {
  await ensureInit();
  const suAn = currentWeekKey();
  const bekleyenler = (await all(
    "SELECT DISTINCT topic_id, hafta FROM predictions WHERE sonuc = 'bekliyor' AND hafta < ?",
    [suAn]
  )) as unknown as { topic_id: number; hafta: string }[];

  let sonuclanan = 0;
  const haftalik = await getWeeklyArchive();

  for (const b of bekleyenler) {
    const sampiyonlar = haftalik.get(b.hafta) ?? [];
    const kazanan = sampiyonlar.find((c) => c.topic_id === Number(b.topic_id));
    if (!kazanan) {
      // O hafta hiç oy almamış: tahminler geçersiz sayılır
      await run(
        "UPDATE predictions SET sonuc = 'yanlis' WHERE topic_id = ? AND hafta = ? AND sonuc = 'bekliyor'",
        [b.topic_id, b.hafta]
      );
      continue;
    }
    const kazananItem = (await get(
      "SELECT id FROM items WHERE topic_id = ? AND name = ? LIMIT 1",
      [b.topic_id, kazanan.itemName]
    )) as { id: number } | undefined;

    await run(
      `UPDATE predictions SET sonuc = CASE WHEN item_id = ? THEN 'dogru' ELSE 'yanlis' END
       WHERE topic_id = ? AND hafta = ? AND sonuc = 'bekliyor'`,
      [Number(kazananItem?.id ?? -1), b.topic_id, b.hafta]
    );
    sonuclanan++;
  }
  return sonuclanan;
}

export async function getTahminim(userId: number, topicId: number): Promise<Tahmin | undefined> {
  await ensureInit();
  const r = (await get(
    "SELECT * FROM predictions WHERE user_id = ? AND topic_id = ? AND hafta = ?",
    [userId, topicId, currentWeekKey()]
  )) as unknown as Tahmin | undefined;
  return r ? { ...r, id: Number(r.id), item_id: Number(r.item_id), topic_id: Number(r.topic_id) } : undefined;
}

export async function tahminKaydet(userId: number, topicId: number, itemId: number) {
  await ensureInit();
  const hafta = currentWeekKey();
  await run(
    `INSERT INTO predictions (user_id, topic_id, item_id, hafta, sonuc, created_at)
     VALUES (?,?,?,?,'bekliyor',?)
     ON CONFLICT (user_id, topic_id, hafta) DO UPDATE SET item_id = ?`,
    [userId, topicId, itemId, hafta, nowSec(), itemId]
  );
}

/** Bu hafta bu listede hangi maddeye kaç tahmin gelmiş. */
export async function getTahminDagilimi(topicId: number): Promise<Map<number, number>> {
  await ensureInit();
  const rows = (await all(
    "SELECT item_id, COUNT(*) AS n FROM predictions WHERE topic_id = ? AND hafta = ? GROUP BY item_id",
    [topicId, currentWeekKey()]
  )) as unknown as { item_id: number; n: number }[];
  return new Map(rows.map((r) => [Number(r.item_id), Number(r.n)]));
}

export type TahminKarnesi = { dogru: number; yanlis: number; bekleyen: number; oran: number };

export async function getTahminKarnesi(userId: number): Promise<TahminKarnesi> {
  await ensureInit();
  const r = (await get(
    `SELECT SUM(CASE WHEN sonuc = 'dogru' THEN 1 ELSE 0 END) AS dogru,
            SUM(CASE WHEN sonuc = 'yanlis' THEN 1 ELSE 0 END) AS yanlis,
            SUM(CASE WHEN sonuc = 'bekliyor' THEN 1 ELSE 0 END) AS bekleyen
     FROM predictions WHERE user_id = ?`,
    [userId]
  )) as unknown as { dogru: number; yanlis: number; bekleyen: number };
  const dogru = Number(r?.dogru ?? 0);
  const yanlis = Number(r?.yanlis ?? 0);
  return {
    dogru,
    yanlis,
    bekleyen: Number(r?.bekleyen ?? 0),
    oran: dogru + yanlis === 0 ? 0 : Math.round((dogru / (dogru + yanlis)) * 100),
  };
}

// ---- Sıra geçmişi ----------------------------------------------------------------

export type SiraNoktasi = { tarih: string; sira: number };

/**
 * Bir başlıktaki maddelerin son N günlük sıra geçmişi.
 * Veri her gün ilk görüntülemede `snapshots` tablosuna yazılır.
 */
export async function getRankHistory(
  topicId: number,
  gun = 14
): Promise<Map<number, SiraNoktasi[]>> {
  await ensureInit();
  const bas = new Date(Date.now() - gun * 86400_000).toISOString().slice(0, 10);
  const rows = (await all(
    `SELECT item_id, snap_date, rank FROM snapshots
     WHERE topic_id = ? AND snap_date >= ?
     ORDER BY snap_date`,
    [topicId, bas]
  )) as unknown as { item_id: number; snap_date: string; rank: number }[];

  const gecmis = new Map<number, SiraNoktasi[]>();
  for (const r of rows) {
    const key = Number(r.item_id);
    const liste = gecmis.get(key) ?? [];
    liste.push({ tarih: r.snap_date, sira: Number(r.rank) });
    gecmis.set(key, liste);
  }
  return gecmis;
}

// ---- Bildirimler ----------------------------------------------------------------

export type Bildirim = {
  id: number;
  body: string;
  link: string;
  okundu: number;
  created_at: number;
};

export async function addNotification(userId: number, body: string, link: string) {
  await ensureInit();
  await run(
    "INSERT INTO notifications (user_id, body, link, okundu, created_at) VALUES (?,?,?,0,?)",
    [userId, body.slice(0, 300), link, nowSec()]
  );
}

export async function getNotifications(userId: number, limit = 30): Promise<Bildirim[]> {
  await ensureInit();
  const rows = (await all(
    `SELECT id, body, link, okundu, created_at FROM notifications
     WHERE user_id = ? ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(100, limit))}`,
    [userId]
  )) as unknown as Bildirim[];
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    okundu: Number(r.okundu),
    created_at: Number(r.created_at),
  }));
}

export async function countUnread(userId: number): Promise<number> {
  await ensureInit();
  const r = (await get(
    "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND okundu = 0",
    [userId]
  )) as unknown as { n: number };
  return Number(r?.n ?? 0);
}

export async function markAllRead(userId: number) {
  await ensureInit();
  await run("UPDATE notifications SET okundu = 1 WHERE user_id = ? AND okundu = 0", [userId]);
}

/** Bir başlığı kimin önerdiği (bildirim göndermek için). */
export async function getTopicOwner(topicId: number): Promise<number | null> {
  await ensureInit();
  const r = (await get("SELECT created_by FROM topics WHERE id = ?", [topicId])) as
    | { created_by: number | null }
    | undefined;
  return r?.created_by == null ? null : Number(r.created_by);
}

export async function getItemOwnerAndTopic(
  itemId: number
): Promise<{ userId: number | null; topicSlug: string; itemName: string } | undefined> {
  await ensureInit();
  const r = (await get(
    `SELECT i.created_by, i.name, t.slug FROM items i
     JOIN topics t ON t.id = i.topic_id WHERE i.id = ?`,
    [itemId]
  )) as { created_by: number | null; name: string; slug: string } | undefined;
  if (!r) return undefined;
  return {
    userId: r.created_by == null ? null : Number(r.created_by),
    topicSlug: r.slug,
    itemName: r.name,
  };
}

// ---- Üye profili ---------------------------------------------------------------

export type ProfilVerisi = {
  user: { id: number; username: string; role: "user" | "admin"; created_at: number };
  sayilar: { basliklar: number; maddeler: number; yorumlar: number; oylar: number };
  basliklar: { slug: string; title: string; status: string; created_at: number }[];
  yorumlar: { id: number; body: string; created_at: number; topicSlug: string; topicTitle: string }[];
};

export async function getUserProfile(username: string): Promise<ProfilVerisi | undefined> {
  await ensureInit();
  const u = await getUserByUsername(username);
  if (!u) return undefined;
  const uid = Number(u.id);

  const s = (await get(
    `SELECT (SELECT COUNT(*) FROM topics WHERE created_by = ? AND status = 'approved') AS basliklar,
            (SELECT COUNT(*) FROM items WHERE created_by = ?) AS maddeler,
            (SELECT COUNT(*) FROM comments WHERE user_id = ? AND status = 'visible') AS yorumlar,
            (SELECT COUNT(*) FROM votes WHERE user_id = ?) AS oylar`,
    [uid, uid, uid, uid]
  )) as unknown as Record<string, number>;

  const basliklar = (await all(
    `SELECT slug, title, status, created_at FROM topics
     WHERE created_by = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 20`,
    [uid]
  )) as unknown as ProfilVerisi["basliklar"];

  const yorumlar = (await all(
    `SELECT c.id, c.body, c.created_at, t.slug AS "topicSlug", t.title AS "topicTitle"
     FROM comments c JOIN topics t ON t.id = c.topic_id
     WHERE c.user_id = ? AND c.status = 'visible'
     ORDER BY c.created_at DESC LIMIT 20`,
    [uid]
  )) as unknown as ProfilVerisi["yorumlar"];

  return {
    user: {
      id: uid,
      username: u.username,
      role: u.role,
      created_at: Number(u.created_at),
    },
    sayilar: {
      basliklar: Number(s?.basliklar ?? 0),
      maddeler: Number(s?.maddeler ?? 0),
      yorumlar: Number(s?.yorumlar ?? 0),
      oylar: Number(s?.oylar ?? 0),
    },
    basliklar: basliklar.map((b) => ({ ...b, created_at: Number(b.created_at) })),
    yorumlar: yorumlar.map((y) => ({ ...y, id: Number(y.id), created_at: Number(y.created_at) })),
  };
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

export async function getUserByEmail(email: string): Promise<User | undefined> {
  await ensureInit();
  return (await get("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [
    email,
  ])) as unknown as User | undefined;
}

export async function getUserByGoogleId(googleId: string): Promise<User | undefined> {
  await ensureInit();
  return (await get("SELECT * FROM users WHERE google_id = ? AND google_id <> ''", [
    googleId,
  ])) as unknown as User | undefined;
}

/** Görünen adı benzersizleştirir (profil adresleri çakışmasın diye). */
export async function benzersizGorunenAd(istek: string): Promise<string> {
  await ensureInit();
  const temiz = istek.replace(/[^\p{L}\p{N}_ -]/gu, "").trim().slice(0, 24) || "uye";
  let ad = temiz;
  let n = 1;
  while (await get("SELECT 1 AS x FROM users WHERE LOWER(username) = LOWER(?)", [ad])) {
    ad = `${temiz}${++n}`;
  }
  return ad;
}

export async function createUser(opts: {
  email: string;
  username: string;
  passHash: string;
  role?: "user" | "admin";
  googleId?: string;
  /** Google ile gelenlerde adres zaten kanıtlanmıştır */
  dogrulandi?: boolean;
}): Promise<number> {
  await ensureInit();
  const row = (await get(
    `INSERT INTO users (username, email, pass_hash, role, google_id, eposta_dogrulandi, created_at)
     VALUES (?,?,?,?,?,?,?) RETURNING id`,
    [
      opts.username,
      opts.email.toLowerCase(),
      opts.passHash,
      opts.role ?? "user",
      opts.googleId ?? "",
      opts.dogrulandi ? 1 : 0,
      nowSec(),
    ]
  )) as { id: number };
  return Number(row.id);
}

/** Var olan hesabı Google kimliğiyle eşler (aynı e-postayla giriş yapıldığında). */
export async function googleBagla(userId: number, googleId: string) {
  await ensureInit();
  await run("UPDATE users SET google_id = ? WHERE id = ?", [googleId, userId]);
}

/**
 * Google, e-posta sahipliğini kanıtlar. Aynı adresle açılmış ama doğrulanmamış
 * bir hesap varsa o hesabı Google'a devrederiz ve parolayı geçersiz kılarız:
 * aksi halde birinin başkasının adresiyle önceden hesap açıp (ön kayıt saldırısı)
 * gerçek sahibi geldiğinde erişimini sürdürmesi mümkün olurdu.
 */
export async function googleDevral(userId: number, googleId: string, yeniHash: string) {
  await ensureInit();
  await run(
    "UPDATE users SET google_id = ?, pass_hash = ?, eposta_dogrulandi = 1 WHERE id = ?",
    [googleId, yeniHash, userId]
  );
  await run("UPDATE auth_tokens SET kullanildi = 1 WHERE user_id = ?", [userId]);
}

export async function epostaDogrulandiIsaretle(userId: number) {
  await ensureInit();
  await run("UPDATE users SET eposta_dogrulandi = 1 WHERE id = ?", [userId]);
}

export async function parolaGuncelle(userId: number, passHash: string) {
  await ensureInit();
  await run("UPDATE users SET pass_hash = ? WHERE id = ?", [passHash, userId]);
}

// ---- Doğrulama / sıfırlama jetonları -------------------------------------------

export type JetonTuru = "dogrula" | "sifirla";

/** Aynı türden eski jetonları geçersiz kılar ve yenisinin özetini saklar. */
export async function jetonOlustur(
  userId: number,
  tur: JetonTuru,
  tokenHash: string,
  omurSaniye: number
): Promise<void> {
  await ensureInit();
  await run("UPDATE auth_tokens SET kullanildi = 1 WHERE user_id = ? AND tur = ?", [userId, tur]);
  await run(
    "INSERT INTO auth_tokens (user_id, tur, token_hash, expires, kullanildi, created_at) VALUES (?,?,?,?,0,?)",
    [userId, tur, tokenHash, nowSec() + omurSaniye, nowSec()]
  );
}

/** Jetonu tüketir: geçerliyse kullanıcı kimliğini döner ve bir daha kullanılamaz. */
export async function jetonTuket(tur: JetonTuru, tokenHash: string): Promise<number | null> {
  await ensureInit();
  const satir = (await get(
    `SELECT id, user_id FROM auth_tokens
     WHERE token_hash = ? AND tur = ? AND kullanildi = 0 AND expires > ?`,
    [tokenHash, tur, nowSec()]
  )) as { id: number; user_id: number } | undefined;
  if (!satir) return null;

  await run("UPDATE auth_tokens SET kullanildi = 1 WHERE id = ?", [Number(satir.id)]);
  return Number(satir.user_id);
}

// ---- Bülten -------------------------------------------------------------------

export type BultenAbone = {
  id: number;
  email: string;
  onaylandi: number;
  cikis_token: string;
  created_at: number;
};

/**
 * Aboneliği kaydeder ya da tazeler. Zaten onaylıysa yeni onay e-postası
 * gerekmediğini bildirir; değilse üretilen onay jetonunu döner.
 */
export async function bultenKaydet(
  email: string,
  kaynak: string
): Promise<{ zatenOnayli: boolean; onayToken: string; cikisToken: string }> {
  await ensureInit();
  const temiz = email.toLowerCase();
  const mevcut = (await get("SELECT * FROM bulten WHERE LOWER(email) = ?", [temiz])) as
    | BultenAbone
    | undefined;

  if (mevcut && Number(mevcut.onaylandi) === 1) {
    return { zatenOnayli: true, onayToken: "", cikisToken: mevcut.cikis_token };
  }

  const onayToken = randomUUID().replace(/-/g, "");
  const cikisToken = mevcut?.cikis_token ?? randomUUID().replace(/-/g, "");

  if (mevcut) {
    await run("UPDATE bulten SET onay_token = ?, created_at = ? WHERE id = ?", [
      onayToken,
      nowSec(),
      Number(mevcut.id),
    ]);
  } else {
    await run(
      "INSERT INTO bulten (email, onaylandi, onay_token, cikis_token, kaynak, created_at) VALUES (?,0,?,?,?,?)",
      [temiz, onayToken, cikisToken, kaynak.slice(0, 40), nowSec()]
    );
  }
  return { zatenOnayli: false, onayToken, cikisToken };
}

/** Onay bağlantısı: jetonu tüketip aboneliği aktifleştirir. */
export async function bultenOnayla(token: string): Promise<boolean> {
  await ensureInit();
  const satir = (await get("SELECT id FROM bulten WHERE onay_token = ? AND onay_token <> ''", [
    token,
  ])) as { id: number } | undefined;
  if (!satir) return false;
  await run("UPDATE bulten SET onaylandi = 1, onay_token = '' WHERE id = ?", [Number(satir.id)]);
  return true;
}

export async function bultenCik(token: string): Promise<boolean> {
  await ensureInit();
  const satir = (await get("SELECT id FROM bulten WHERE cikis_token = ?", [token])) as
    | { id: number }
    | undefined;
  if (!satir) return false;
  await run("DELETE FROM bulten WHERE id = ?", [Number(satir.id)]);
  return true;
}

export async function bultenAboneleri(): Promise<BultenAbone[]> {
  await ensureInit();
  return (await all(
    "SELECT * FROM bulten WHERE onaylandi = 1 ORDER BY created_at DESC"
  )) as unknown as BultenAbone[];
}

export async function bultenSayilari(): Promise<{ onayli: number; bekleyen: number }> {
  await ensureInit();
  const r = (await get(
    `SELECT (SELECT COUNT(*) FROM bulten WHERE onaylandi = 1) AS onayli,
            (SELECT COUNT(*) FROM bulten WHERE onaylandi = 0) AS bekleyen`
  )) as { onayli: number; bekleyen: number } | undefined;
  return { onayli: Number(r?.onayli ?? 0), bekleyen: Number(r?.bekleyen ?? 0) };
}

export async function bultenGonderimIsaretle(idler: number[]) {
  if (!idler.length) return;
  await ensureInit();
  await run(
    `UPDATE bulten SET son_gonderim = ? WHERE id IN (${idler.map(() => "?").join(",")})`,
    [nowSec(), ...idler]
  );
}

/** Son N saniyede bu kullanıcı için üretilmiş jeton sayısı (kötüye kullanım freni). */
export async function jetonSayisi(userId: number, tur: JetonTuru, pencere: number): Promise<number> {
  await ensureInit();
  const r = (await get(
    "SELECT COUNT(*) AS n FROM auth_tokens WHERE user_id = ? AND tur = ? AND created_at > ?",
    [userId, tur, nowSec() - pencere]
  )) as { n: number } | undefined;
  return Number(r?.n ?? 0);
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

  // Varsayılan yönetici: admin@trendmatik.local / trendmatik2026!
  // (ilk girişten sonra değiştirin)
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync("trendmatik2026!", salt, 64).toString("hex");
  await run(
    "INSERT INTO users (username, email, pass_hash, role, google_id, created_at) VALUES (?,?,?,?,'',?)",
    ["admin", "admin@trendmatik.local", `${salt}:${hash}`, "admin", nowSec()]
  );

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
  const GECMIS_GUN = 14; // tohumda üretilecek sıra geçmişi uzunluğu

  // Oylayan havuzu: aynı kişiler birden çok maddeye/başlığa oy verir.
  // Her oya benzersiz kimlik verilirse hiç kimse iki şeyi birden oylamamış
  // olur ve "bunu oylayan şunu da oyladı" gibi analizler boş döner.
  const havuz = Array.from({ length: 240 }, () => `seed-${randomUUID()}`);
  const kullanilan = new Set<string>(); // item|oylayan|tarih tekrarını önler

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
        const tarih = new Date(created * 1000).toISOString().slice(0, 10);
        const oylayan = havuz[Math.floor(Math.random() * havuz.length)];
        const anahtar = `${item.id}|${oylayan}|${tarih}`;
        if (kullanilan.has(anahtar)) continue; // aynı gün aynı maddeye ikinci oy yok
        kullanilan.add(anahtar);
        voteRows.push([
          Number(item.id),
          oylayan,
          null,
          Math.random() < 0.88 ? 1 : -1,
          Math.random() < 0.35 ? 2 : 1,
          tarih,
          created,
        ]);
      }
    });

    // 14 günlük sıra geçmişi: karışık bir başlangıçtan bugünkü sıraya doğru
    // kademeli yakınsar. Böylece sparkline'lar gerçekçi dalgalanma gösterir.
    const hedef = active.map((it) => Number(it.id));
    const sira = [...hedef];
    for (let i = sira.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sira[i], sira[j]] = [sira[j], sira[i]];
    }
    for (let d = GECMIS_GUN; d >= 1; d--) {
      const tarih = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
      sira.forEach((id, idx) => snapRows.push([topicId, id, idx + 1, tarih]));

      // Her gün birkaç madde hedef sırasına bir adım yaklaşsın
      const hamle = Math.max(1, Math.round(sira.length / 3));
      for (let h = 0; h < hamle; h++) {
        const k = Math.floor(Math.random() * sira.length);
        const hedefIdx = hedef.indexOf(sira[k]);
        if (hedefIdx === k) continue;
        const komsu = k + (hedefIdx > k ? 1 : -1);
        if (komsu < 0 || komsu >= sira.length) continue;
        [sira[k], sira[komsu]] = [sira[komsu], sira[k]];
      }
    }
  }

  await insertMany(
    "votes",
    ["item_id", "voter_key", "user_id", "value", "weight", "vote_date", "created_at"],
    voteRows
  );
  await insertMany("snapshots", ["topic_id", "item_id", "rank", "snap_date"], snapRows);
}
