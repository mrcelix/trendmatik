import Link from "next/link";
import { bultenCik } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bülten aboneliği", robots: { index: false } };

export default async function BultenCikPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cikildi = await bultenCik(token);

  return (
    <div className="container">
      <div className="hata-kart">
        <div className="hata-ikon" aria-hidden="true">{cikildi ? "👋" : "🤔"}</div>
        <h1>{cikildi ? "Aboneliğin sonlandırıldı" : "Bağlantı geçersiz"}</h1>
        <p>
          {cikildi
            ? "Bundan sonra bülten göndermeyeceğiz. Fikrin değişirse alt bilgideki formdan tekrar abone olabilirsin."
            : "Bu çıkış bağlantısı geçersiz ya da abonelik zaten sonlandırılmış."}
        </p>
        <div className="hata-dugmeler">
          <Link href="/" className="btn btn-primary">Ana sayfa</Link>
          <Link href="/hafta" className="btn">Bu haftanın özeti</Link>
        </div>
      </div>
    </div>
  );
}
