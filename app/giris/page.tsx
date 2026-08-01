import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { googleAcikMi } from "@/lib/google";
import AuthPopup from "@/components/AuthPopup";

export const dynamic = "force-dynamic";

/**
 * Giriş sayfası — asıl akış üst bardaki popup üzerinden yürüyor.
 * Bu sayfa doğrudan bağlantıyla gelenler ve yönlendirmelerdeki hata
 * mesajları için duruyor.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="container">
      <div className="form-card">
        <h1>Giriş Yap</h1>
        {e && <p className="alert-err">{e}</p>}
        <p className="form-note" style={{ marginTop: 0, marginBottom: 16 }}>
          E-posta adresinle giriş yap. Üye oyları ×2 sayılır; listeleri takip edebilir,
          tahmin oynayabilirsin.
        </p>
        <AuthPopup
          googleAcik={googleAcikMi()}
          acilisSekmesi="giris"
          tetikSinifi="btn btn-primary"
          tetikMetni="Giriş penceresini aç"
        />
        <p className="form-note">
          Hesabın yok mu? <Link href="/kayit">Üye ol</Link>.
        </p>
      </div>
    </div>
  );
}
