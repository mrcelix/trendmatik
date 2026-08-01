import Link from "next/link";
import SifirlamaTamamla from "@/components/SifirlamaTamamla";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni parola belirle" };

export default async function SifirlaJetonPage({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;

  return (
    <div className="container">
      <div className="form-card">
        <h1>Yeni parola belirle</h1>
        <p className="form-note" style={{ marginTop: 0, marginBottom: 18 }}>
          Yeni parolanı gir. Kaydedince oturumun otomatik açılır.
        </p>
        {/* Jeton burada doğrulanmaz: geçerliliği kaydederken tek seferde
            tüketilir, böylece bağlantıyı açmak jetonu harcamaz. */}
        <SifirlamaTamamla jeton={jeton} />
        <p className="form-note">
          Bağlantının süresi dolduysa <Link href="/sifirla">yenisini iste</Link>.
        </p>
      </div>
    </div>
  );
}
