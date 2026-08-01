import Link from "next/link";
import SifirlamaIste from "@/components/SifirlamaIste";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parolamı unuttum" };

export default function SifirlaPage() {
  return (
    <div className="container">
      <div className="form-card">
        <h1>Parolamı unuttum</h1>
        <p className="form-note" style={{ marginTop: 0, marginBottom: 18 }}>
          Hesabının e-posta adresini yaz; sıfırlama bağlantısını gönderelim.
          Bağlantı bir saat geçerli olur.
        </p>
        <SifirlamaIste />
        <p className="form-note">
          Hatırladın mı? <Link href="/giris">Giriş yap</Link>.
        </p>
      </div>
    </div>
  );
}
