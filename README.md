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
  aynı gün fikir değiştirme oyu günceller. Misafir ağırlık 1 (çerez `tn_vid`), doğrulanmış üye 2.
  Çerezi yeni olan ziyaretçinin oyu ×0.5 sayılır (güven kesintisi) — bu yüzden `votes.weight`
  ondalık tutulur; INTEGER kaldığında Postgres yuvarlıyor ve kesinti etkisiz kalıyordu.
- **▲▼ göstergeleri:** `snapshots` tablosu — günün ilk görüntülemesinde o günün sırası kaydedilir,
  fark bir önceki güne göre hesaplanır. Snapshot'ta olmayan madde "YENİ".
- `lib/auth.ts` — scrypt parola, HMAC imzalı oturum çerezi (`tn_sess`), gizli anahtar `data/secret.key`.
- `lib/actions.ts` — server actions: giriş/kayıt/çıkış, başlık+madde önerisi, admin onay/ret.
- `app/api/vote/route.ts` — oy API'si (misafir çerezini de burada oluşturur).
- **Önbellek:** sayfalar dinamik (kök layout çerez okuyor), ama pahalı sorgular `unstable_cache`
  ile 60 sn önbellekte (`ICERIK_TTL`, etiket `ICERIK_ETIKETI`) — liste özetleri, menü, hero,
  kategoriler, şehirler. Yönetim eylemleri `updateTag` ile anında geçersiz kılar. Liste sayfasının
  kendi sıralaması (`getTopicBoard`) bilerek önbelleğe alınmaz: oy anında görünür.
- Genel sayfalar: `/` (Yükselenler/Popüler sekmeli), `/kategori/[slug]`, `/liste/[slug]`,
  `/hizli` (kart kart hızlı oylama), `/hafta`, `/arsiv`, `/sehir` + `/sehir/[slug]`, `/blog`,
  `/bulten`, `/uye/[kullanici]`, `/gomulu/[slug]` (gömülebilir widget), `/api` (açık API),
  `/giris`, `/kayit`, `/oner`.
- Yönetim (`/admin`, hepsi yönetici oturumu ister): gösterge paneli, moderasyon, listeler,
  kategoriler, **gündemi tara** (1/7/15/30 günlük pencere), hazır içerik, künye onayı
  (site + görsel taraması), hero alanı, mega menü, blog, bülten, sponsorlar, üyeler,
  istatistikler, ayarlar & kayıtlar.
- `app/api/kart/[slug]/route.tsx` — `next/og` ile 1200×630 PNG paylaşım kartı; başlık sayfalarının
  OG görseli olarak da kullanılır (`generateMetadata`).
- Temalar: `gunduz` (varsayılan) ve `gece` — `<html data-theme>` + `tn_theme` çerezi;
  `components/ThemeSwitcher.tsx`, değişkenler `app/globals.css` içinde.

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

### Teşhis: `/api/durum`
Yayın sorunlarında `https://<site>/api/durum` adresi hangi ayarın eksik olduğunu söyler —
ortam değişkenleri var mı, hangi sürücü kullanılıyor, veritabanına bağlanılabiliyor mu.
Yalnızca "var/yok" bilgisi ve temizlenmiş hata metni döner; bağlantı adresi, parola veya
anahtar gibi gizli değerler **hiçbir zaman** yazılmaz.

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
- [ ] `admin` parolasını varsayılandan değiştirin.
- [ ] `DATABASE_URL` ve `SESSION_SECRET` yalnız ortam değişkeni olarak; commit etmeyin.
- [ ] Yedek işi çalışıyor mu bakın (aşağıya bakın).

## Yedek ve geri yükleme

`.github/workflows/yedek.yml` her gün 02:00 UTC'de (Türkiye 05:00) `pg_dump` alır ve
sonucu **AES256 ile şifreleyip** iş çıktısına (artifact) 90 gün saklar. Bu depo herkese
açık olduğu için şifreleme şart: döküm kullanıcı e-postalarını ve parola özetlerini içerir.

İki depo secret'ı gerekir (Settings → Secrets and variables → Actions):

| Secret | Değer |
|---|---|
| `YEDEK_DB_URL` | Supabase **session pooler** adresi — `…pooler.supabase.com:5432`. Transaction pooler (6543) `pg_dump` için uygun değil, doğrudan adres (`db.*.supabase.co`) IPv6 gerektirir ve GitHub runner'larında çözülmez. |
| `YEDEK_PAROLA` | Şifre çözmek için kullanacağınız uzun bir parola. **Parola yöneticisinde saklayın** — kaybolursa yedekler açılamaz. |

Elle çalıştırmak: Actions → *Veritabanı Yedeği* → Run workflow.

İş, dökümü boyut ve `pg_restore --list` ile doğrular; boş ya da yarım bir yedek sessizce
geçmez, adım hata verir.

### Geri yükleme

Artifact'ı indirip açın, sonra:

```bash
gpg --batch --decrypt --passphrase 'YEDEK_PAROLA' -o yedek.dump yedek-2026-01-01-0200.dump.gpg
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" yedek.dump
```

Boş bir projeye yüklüyorsanız önce şemanın kurulması gerekir: `DATABASE_URL`'i verip
uygulamayı bir kez açın (`migrate()` tabloları kurar), sonra `pg_restore` çalıştırın.
`pg_dump` yalnızca `public` şemasını alır; Supabase'in `auth`/`storage` şemalarına dokunmaz.

## Notlar
- Varsayılan yönetici hesabı ilk tohumlamada `admin` kullanıcı adıyla, kodda gömülü bir varsayılan
  parolayla oluşturulur (`lib/db.ts`) — canlıya çıkmadan değiştirin (`users` tablosu).
- Tüm sayfalar sunucuda render edilir (`force-dynamic`); veritabanı erişimi yalnız sunucuda.
- `data/` klasörü (yerel veritabanı + gizli anahtar) commit edilmemeli (`.gitignore`'da).
