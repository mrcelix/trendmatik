# TrendMatik — Türkiye'nin Trend Sıralamaları

Topluluk oylamalı Top 10 trend listeleri sitesi (Next.js 16 App Router + TypeScript).
Kategoriler: Mekan / Hizmet / Website / Konu / Ürün / Haber. TheTopTens + Ranker + Product Hunt
modellerinin bileşimi.

## Komutlar
- `npm run dev` — geliştirme sunucusu (http://localhost:3000)
- `npm run build` / `npm start` — üretim
- `npx tsc --noEmit` — tip kontrolü

## Veritabanı: çift sürücü
`lib/db.ts` tek veri katmanıdır ve iki modda çalışır:
- **Yerel (varsayılan):** `DATABASE_URL` tanımlı değilse Node yerleşik `node:sqlite`
  (`data/trendmatik.db`; ilk çalıştırmada şema kurulur ve Türkçe örnek veriyle tohumlanır).
- **Üretim (Supabase):** `.env` içinde `DATABASE_URL` verilirse `pg` ile Postgres'e bağlanır;
  tablolar ilk açılışta otomatik oluşturulur ve boşsa tohumlanır. `.env.example`'a bakın.

Sorgular `?` yer tutucusuyla yazılır, Postgres'e `$1,$2…` çevrilir; lehçe farkları (SERIAL,
LOWER-unique kullanıcı adı, ON CONFLICT) `migrate()` içinde ele alınır. Hafta/ay anahtarları ve
puanlar JS'te hesaplanır, SQL lehçesinden bağımsızdır.

## Mimarî
- **Puanlama:** Popüler = Σ(oy×ağırlık). Yükselen = Hacker News tarzı zaman çürümesi:
  her oyun katkısı `değer×ağırlık / (yaş_saat+2)^1.5`.
- **Oy kuralları:** madde başına kişi başına günde 1 oy (`UNIQUE(item_id, voter_key, vote_date)`);
  aynı gün fikir değiştirme oyu günceller. Misafir ağırlık 1 (çerez `tn_vid`), üye ağırlık 2.
- **▲▼ göstergeleri:** `snapshots` tablosu — günün ilk görüntülemesinde o günün sırası kaydedilir,
  fark bir önceki güne göre hesaplanır. Snapshot'ta olmayan madde "YENİ".
- `lib/auth.ts` — scrypt parola, HMAC imzalı oturum çerezi (`tn_sess`), gizli anahtar `data/secret.key`.
- `lib/actions.ts` — server actions: giriş/kayıt/çıkış, başlık+madde önerisi, admin onay/ret.
- `app/api/vote/route.ts` — oy API'si (misafir çerezini de burada oluşturur).
- Sayfalar: `/` (Yükselenler/Popüler sekmeli), `/kategori/[slug]`, `/liste/[slug]` (Top 10 + adaylar +
  🏆 geçen haftanın şampiyonu), `/arsiv` (haftalık/aylık zirve şampiyonları), `/giris`, `/kayit`,
  `/oner` (üyelere özel; admin başlıkları onaysız yayınlanır), `/admin` (onay kuyruğu + Google Trends
  TR gündem adayları [`lib/trends.ts`, 30 dk önbellek] + son 24 saat oy anomalileri).
- `app/api/kart/[slug]/route.tsx` — `next/og` ile 1200×630 PNG paylaşım kartı; başlık sayfalarının
  OG görseli olarak da kullanılır (`generateMetadata`).
- Temalar: `app/globals.css` içinde 4 preset (`minimal` açık varsayılan, `gundem`, `editoryal`,
  `enerjik`) — `<html data-theme>` + `tn_theme` çerezi; `components/ThemeSwitcher.tsx`.

## İçerik akışı
Üye başlık önerir (durum `pending`) → admin onaylar (`approved`) → yayına girer.
Üye maddeye "aday" önerir (`pending`) → admin "Aday Yap" (`candidate`, oylanabilir ama Top 10 dışı)
veya "Doğrudan Listeye" (`active`). Top 10 = aktif maddelerin puan sırasına göre ilk 10'u.

## Ortam değişkenleri

| Değişken | Zorunlu mu? | Açıklama |
|---|---|---|
| `DATABASE_URL` | Sunucusuz ortamda **evet** | Supabase Postgres bağlantı adresi. Boşsa yerel SQLite kullanılır. |
| `SESSION_SECRET` | Sunucusuz ortamda **evet** | Oturum çerezlerini imzalayan ≥32 karakterlik rastgele değer. Yerelde yoksa `data/secret.key` üretilir. |

Vercel gibi dosya sistemi kalıcı olmayan ortamlarda ikisi de zorunludur; eksikse uygulama
ne olduğunu açıkça söyleyen bir hata verir (sessizce bozulmaz).

## Yayınlama: Vercel + Supabase

### 1. Supabase (veritabanı)
1. [supabase.com](https://supabase.com) → ücretsiz proje açın (bölge: `eu-central` Frankfurt önerilir).
2. Project Settings → Database → **Connection string (URI)** → **Transaction pooler** (port 6543)
   adresini kopyalayın. Sunucusuz ortamda mutlaka pooler adresi kullanılmalı — doğrudan bağlantı
   (5432) fonksiyon başına bağlantı açtığı için kotayı tüketir.
3. Adresteki `[YOUR-PASSWORD]` kısmını gerçek parolayla değiştirin.

### 2. Vercel (uygulama)
1. **Önce kodu GitHub'a gönderin** — Vercel yalnızca depodaki dosyaları derler.
2. Vercel → Add New → Project → depoyu içe aktarın (framework otomatik "Next.js" algılanır).
3. **Settings → Environment Variables** altına ekleyin (Production + Preview):
   - `DATABASE_URL` = Supabase pooler adresi
   - `SESSION_SECRET` = rastgele uzun bir değer
4. Deploy. Tablolar ve örnek veri **ilk sayfa isteğinde** otomatik kurulur; elle SQL yok.

### Alternatif: Hostinger VPS
Next.js sunucu gerektirir; paylaşımlı hosting yetmez, **VPS** gerekir:
```bash
npm install && npm run build
DATABASE_URL="postgresql://..." SESSION_SECRET="..." npm start
```
Kalıcı çalıştırma `pm2 start npm --name trendmatik -- start`; Caddy ile ters vekil ve otomatik SSL:
`siteadi.com { reverse_proxy localhost:3000 }`. VPS'te `DATABASE_URL` vermezseniz yerel SQLite de
kullanılabilir (`data/` klasörünü yedekleyin).

### Yayın öncesi kontrol listesi
- [ ] `admin` parolasını değiştirin (varsayılan: `trendmatik2026!`).
- [ ] `DATABASE_URL` ve `SESSION_SECRET` yalnız ortam değişkeni olarak; commit etmeyin.
- [ ] Supabase panosunda günlük yedek (Backups) açık mı bakın.

## Notlar
- Varsayılan yönetici: `admin / trendmatik2026!` — canlıya çıkmadan değiştirin (`users` tablosu).
- Tüm sayfalar sunucuda render edilir (`force-dynamic`); veritabanı erişimi yalnız sunucuda.
- `data/` klasörü (yerel veritabanı + gizli anahtar) commit edilmemeli (`.gitignore`'da).
