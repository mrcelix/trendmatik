import type { SiraNoktasi } from "@/lib/db";

/**
 * Sıra geçmişi grafiği — sunucuda üretilen satır içi SVG (istemci kodu yok).
 * Y ekseni ters: 1. sıra en üstte. Sıra iyileşiyorsa yeşil, kötüleşiyorsa kırmızı.
 */
export default function RankSparkline({
  gecmis,
  toplamMadde,
  ad,
}: {
  gecmis: SiraNoktasi[];
  toplamMadde: number;
  ad: string;
}) {
  if (gecmis.length < 2) {
    return <span className="spark spark-bos" title="Henüz yeterli geçmiş yok">—</span>;
  }

  const G = 74; // genişlik
  const Y = 24; // yükseklik
  const p = 3; // kenar payı
  const enKotu = Math.max(toplamMadde, ...gecmis.map((n) => n.sira));

  const noktalar = gecmis.map((n, i) => {
    const x = p + (i / (gecmis.length - 1)) * (G - 2 * p);
    // sira 1 → en üst, sira enKotu → en alt
    const oran = enKotu === 1 ? 0 : (n.sira - 1) / (enKotu - 1);
    const y = p + oran * (Y - 2 * p);
    return [x, y] as const;
  });

  const cizgi = noktalar.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const alan = `${cizgi} L${noktalar[noktalar.length - 1][0].toFixed(1)},${Y - p} L${noktalar[0][0].toFixed(1)},${Y - p} Z`;

  const ilk = gecmis[0].sira;
  const son = gecmis[gecmis.length - 1].sira;
  const yon = ilk === son ? "sabit" : son < ilk ? "yukseldi" : "dustu";
  const [sx, sy] = noktalar[noktalar.length - 1];

  const ozet =
    yon === "sabit"
      ? `${ad}: son ${gecmis.length} günde sıra değişmedi (${son}.)`
      : yon === "yukseldi"
        ? `${ad}: ${ilk}. sıradan ${son}. sıraya yükseldi`
        : `${ad}: ${ilk}. sıradan ${son}. sıraya geriledi`;

  return (
    <svg
      className={`spark spark-${yon}`}
      viewBox={`0 0 ${G} ${Y}`}
      width={G}
      height={Y}
      role="img"
      aria-label={ozet}
    >
      <title>{ozet}</title>
      <path className="spark-alan" d={alan} />
      <path className="spark-cizgi" d={cizgi} />
      <circle className="spark-uc" cx={sx} cy={sy} r={2.4} />
    </svg>
  );
}
