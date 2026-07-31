import Link from "next/link";
import { loginAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  return (
    <div className="form-card">
      <h1>Giriş Yap</h1>
      {e && <p className="alert-err">{e}</p>}
      <form action={loginAction}>
        <div className="field">
          <label htmlFor="username">Kullanıcı adı</label>
          <input id="username" name="username" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">Parola</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn btn-primary" type="submit">Giriş</button>
      </form>
      <p className="form-note">
        Hesabın yok mu? <Link href="/kayit" style={{ color: "var(--accent)" }}>Üye ol</Link> — üye oyları ×2 sayılır,
        yeni başlık önerebilirsin.
      </p>
    </div>
  );
}
