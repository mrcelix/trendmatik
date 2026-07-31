import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getNotifications, markAllRead } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bildirimler",
  robots: { index: false },
};

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/giris?e=" + encodeURIComponent("Bildirimleri görmek için giriş yapın."));
  }

  const bildirimler = await getNotifications(user!.id);
  // Sayfa açıldığında hepsi okundu sayılır
  await markAllRead(user!.id);

  return (
    <div className="container">
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> › Bildirimler
      </div>
      <div className="page-head">
        <h1>🔔 Bildirimler</h1>
        <span className="sub">{bildirimler.length} kayıt</span>
      </div>

      {bildirimler.length === 0 && (
        <p className="admin-empty">
          Henüz bildirim yok. Liste ya da madde önerdiğinde, listene yorum geldiğinde burada görürsün.
        </p>
      )}

      <ol className="bildirim-listesi">
        {bildirimler.map((b) => (
          <li key={b.id}>
            <Link href={b.link} className={`bildirim ${b.okundu ? "" : "yeni"}`}>
              <span className="bildirim-nokta" aria-hidden="true" />
              <span className="bildirim-govde">
                <b>{b.body}</b>
                <time dateTime={new Date(b.created_at * 1000).toISOString()}>
                  {new Date(b.created_at * 1000).toLocaleString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </span>
              <span className="fr-go">→</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
