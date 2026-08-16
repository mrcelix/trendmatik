import type { Metadata } from "next";
import Link from "next/link";
import { hizliOylamaAdaylari } from "@/lib/db";
import { mutlak } from "@/lib/site";
import { ogTemel } from "@/lib/site";
import HizliOyla from "@/components/HizliOyla";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hızlı Oyla",
  description:
    "Kart kart gelen mekan, ürün ve konulara tek dokunuşla oy ver — sıralamalar anında değişsin.",
  alternates: { canonical: "/hizli" },
  openGraph: {
    ...ogTemel(),
    title: "Hızlı Oyla — TrendMatik",
    description: "Tek dokunuşla oy ver, sıralamayı sen belirle.",
    url: mutlak("/hizli"),
  },
};

export default async function HizliPage() {
  const kartlar = await hizliOylamaAdaylari(40);

  return (
    <div className="container hizli-sayfa">
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> › Hızlı Oyla
      </div>

      <div className="page-head">
        <h1>⚡ Hızlı Oyla</h1>
        <span className="sub">Tek dokunuşla oy ver, sıralamayı sen belirle</span>
      </div>

      {kartlar.length === 0 ? (
        <p className="admin-empty">Şu an oylanacak madde yok.</p>
      ) : (
        <>
          <p className="form-note" style={{ marginTop: 0 }}>
            Kartlar en az oy almış maddelerden başlar — yani verdiğin oy en çok
            burada fark yaratır. Misafir oyu 1, doğrulanmış üye oyu 2 sayılır.
          </p>
          <HizliOyla kartlar={kartlar} />
        </>
      )}
    </div>
  );
}
