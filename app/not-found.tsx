import Link from "next/link";

export const metadata = { title: "Sayfa bulunamadı" };

export default function NotFound() {
  return (
    <div className="container">
      <div className="hata-kart">
        <div className="hata-ikon" aria-hidden="true">🧭</div>
        <h1>Bu sayfa yok</h1>
        <p>
          Aradığınız liste kaldırılmış ya da adres yanlış yazılmış olabilir.
          Aşağıdan devam edebilirsiniz.
        </p>
        <div className="hata-dugmeler">
          <Link href="/" className="btn btn-primary">Ana sayfa</Link>
          <Link href="/arsiv" className="btn">Zirve arşivi</Link>
          <Link href="/oner" className="btn">Liste öner</Link>
        </div>
      </div>
    </div>
  );
}
