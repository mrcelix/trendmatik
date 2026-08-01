import { avatarHarfleri, avatarRengi, gorselGecerliMi } from "@/lib/gorsel";

/**
 * Madde görseli. Adres yoksa ya da geçersizse addan türeyen harf avatarı
 * çizilir — böylece liste her durumda hizalı ve dolu görünür.
 *
 * next/image kullanılmıyor: görseller üçüncü taraf alan adlarından geliyor,
 * hepsini remotePatterns'a açmak siteyi açık bir görsel vekiline çevirirdi.
 * Bunun yerine sabit boyutlu, tembel yüklenen <img> kullanılıyor.
 */
export default function MaddeGorseli({
  ad,
  gorsel,
  boyut = 44,
}: {
  ad: string;
  gorsel?: string | null;
  boyut?: number;
}) {
  const gecerli = gorsel ? gorselGecerliMi(gorsel) : false;

  if (!gecerli) {
    return (
      <span
        className="madde-gorsel madde-avatar"
        style={{ width: boyut, height: boyut, background: avatarRengi(ad) }}
        aria-hidden="true"
      >
        {avatarHarfleri(ad)}
      </span>
    );
  }

  return (
    <img
      className="madde-gorsel"
      src={gorsel!}
      alt=""
      width={boyut}
      height={boyut}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      style={{ width: boyut, height: boyut }}
    />
  );
}
