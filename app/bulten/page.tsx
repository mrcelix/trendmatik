import Link from "next/link";
import BultenForm from "@/components/BultenForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Haftalık bülten",
  description:
    "TrendMatik haftalık bülteni: zirve değişimleri, en çok yükselenler ve haftanın listeleri. Haftada bir e-posta.",
};

export default async function BultenPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum } = await searchParams;

  if (durum === "onaylandi") {
    return (
      <div className="container">
        <div className="hata-kart">
          <div className="hata-ikon" aria-hidden="true">🎉</div>
          <h1>Aboneliğin onaylandı</h1>
          <p>
            Her pazartesi haftanın zirve değişimlerini, en çok yükselenleri ve
            öne çıkan listeleri göndereceğiz. Her e-postanın altında tek tıkla
            çıkış bağlantısı olacak.
          </p>
          <div className="hata-dugmeler">
            <Link href="/" className="btn btn-primary">Ana sayfa</Link>
            <Link href="/hafta" className="btn">Bu haftanın özeti</Link>
          </div>
        </div>
      </div>
    );
  }

  if (durum === "gecersiz") {
    return (
      <div className="container">
        <div className="hata-kart">
          <div className="hata-ikon" aria-hidden="true">⚠️</div>
          <h1>Onay bağlantısı geçersiz</h1>
          <p>Bağlantı kullanılmış ya da yanlış kopyalanmış olabilir. Aşağıdan tekrar deneyebilirsin.</p>
          <div style={{ maxWidth: 380, margin: "0 auto" }}>
            <BultenForm kaynak="bulten-sayfasi" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="form-card">
        <h1>Haftalık bülten</h1>
        <p className="form-note" style={{ marginTop: 0, marginBottom: 18 }}>
          Her pazartesi tek e-posta: haftanın zirve değişimleri, en çok yükselen
          maddeler ve öne çıkan listeler. İstediğin an tek tıkla çıkabilirsin.
        </p>
        <BultenForm kaynak="bulten-sayfasi" />
      </div>
    </div>
  );
}
