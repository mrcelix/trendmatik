import Link from "next/link";
import { registerAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  return (
    <div className="form-card">
      <h1>Üye Ol</h1>
      {e && <p className="alert-err">{e}</p>}
      <form action={registerAction}>
        <div className="field">
          <label htmlFor="username">Kullanıcı adı</label>
          <input id="username" name="username" autoComplete="username" required minLength={3} maxLength={24} />
        </div>
        <div className="field">
          <label htmlFor="password">Parola (en az 6 karakter)</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} />
        </div>
        <button className="btn btn-primary" type="submit">Üye Ol</button>
      </form>
      <p className="form-note">
        Üyelik ayrıcalıkları: oyların ×2 sayılır, yeni başlık ve madde önerebilirsin.
        Zaten üye misin? <Link href="/giris" style={{ color: "var(--accent)" }}>Giriş yap</Link>.
      </p>
    </div>
  );
}
