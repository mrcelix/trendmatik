"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sayfayla birlikte yüzen yan sütun.
 *
 * Sütun ekrandan uzun olduğu için düz `top` sabitlemesi alttaki kutuları
 * erişilemez bırakıyordu. `bottom` ile sabitleme ise grid öğesinde
 * tarayıcılar arasında güvenilir çalışmıyor (ölçtük: `top` tutuyor,
 * `bottom` tutmuyor).
 *
 * Bu yüzden aynı davranış NEGATİF `top` ile kuruluyor:
 *   top = ekranYüksekliği − sütunYüksekliği − altBoşluk
 * Sütun önce normal akışta tamamen okunuyor, alt kenarı ekranın altına
 * geldiğinde pinleniyor ve sayfanın kalanı boyunca görünür kalıyor.
 * Sütun ekrana sığıyorsa üstten sabitleniyor.
 */
const UST_BOSLUK = 84; // yapışkan başlık + nefes payı
const ALT_BOSLUK = 20;

export default function YuzenSutun({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [ust, setUst] = useState<number>(UST_BOSLUK);

  useEffect(() => {
    const oge = ref.current;
    if (!oge) return;

    const hesapla = () => {
      const h = oge.offsetHeight;
      const vh = window.innerHeight;
      setUst(h + UST_BOSLUK <= vh ? UST_BOSLUK : vh - h - ALT_BOSLUK);
    };

    hesapla();
    // Kutular sonradan büyüyebilir (görsel yüklenmesi, açılan değer)
    const gozlemci = new ResizeObserver(hesapla);
    gozlemci.observe(oge);
    window.addEventListener("resize", hesapla);
    return () => {
      gozlemci.disconnect();
      window.removeEventListener("resize", hesapla);
    };
  }, []);

  return (
    <aside ref={ref} className={className} aria-label={ariaLabel} style={{ top: `${ust}px` }}>
      {children}
    </aside>
  );
}
