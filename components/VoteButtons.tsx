"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function VoteButtons({
  itemId,
  myVote,
}: {
  itemId: number;
  myVote: number | undefined; // bugünkü oyum: 1, -1 veya undefined
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function vote(value: 1 | -1) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, value }),
      });
      const data = await res.json();
      if (data.ok) {
        if (!data.changed) {
          setFlash("Bugün zaten bu yönde oy verdin");
          setTimeout(() => setFlash(null), 2200);
        } else if (data.member && data.weight >= 2) {
          setFlash("Üye oyu ×2 sayıldı ✓");
          setTimeout(() => setFlash(null), 1600);
        } else if (data.weight < 1) {
          // Yeni ziyaretçi: güven kazanana kadar yarım ağırlık
          setFlash("Oyun sayıldı — üye olursan ×2 sayılır");
          setTimeout(() => setFlash(null), 2400);
        }
        startTransition(() => router.refresh());
      } else if (data.error) {
        // Sınıra takıldı (429) — sebebi kullanıcıya söyle
        setFlash(data.error);
        setTimeout(() => setFlash(null), 3200);
      }
    } finally {
      setBusy(false);
    }
  }

  const dim = busy || pending;
  return (
    <span className="vote-box">
      <button
        className={`vote-btn up ${myVote === 1 ? "picked" : ""}`}
        onClick={() => vote(1)}
        disabled={dim}
        title="Yukarı oy"
      >
        ▲
      </button>
      <button
        className={`vote-btn down ${myVote === -1 ? "picked" : ""}`}
        onClick={() => vote(-1)}
        disabled={dim}
        title="Aşağı oy"
      >
        ▼
      </button>
      {flash && <span className="vote-flash">{flash}</span>}
    </span>
  );
}
