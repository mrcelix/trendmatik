import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { googleAcikMi } from "@/lib/google";
import AuthPopup from "@/components/AuthPopup";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
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
        <h1>Üye Ol</h1>
        {e && <p className="alert-err">{e}</p>}
        <p className="form-note" style={{ marginTop: 0, marginBottom: 16 }}>
          Üyelik ücretsiz. Oyların ×2 sayılır; liste ve madde önerebilir, kendi sıralamanı
          kaydedebilir, tahmin oyununa katılabilirsin.
        </p>
        <AuthPopup
          googleAcik={googleAcikMi()}
          acilisSekmesi="kayit"
          tetikSinifi="btn btn-primary"
          tetikMetni="Kayıt penceresini aç"
        />
        <p className="form-note">
          Zaten üye misin? <Link href="/giris">Giriş yap</Link>.
        </p>
      </div>
    </div>
  );
}
