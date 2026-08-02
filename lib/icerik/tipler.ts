/**
 * Hazır liste içeriği.
 *
 * Alan adları kısa tutuldu: dosyalarda 600 liste var, uzun anahtarlar
 * dosyaları okunamaz hâle getiriyordu.
 *   t = başlık, a = alt kategori, c = şehir, d = açıklama, m = maddeler
 */
export type ListeTaslagi = {
  t: string;
  a: string;
  c?: string;
  d?: string;
  m: string[];
};

/** Bir ana kategorinin tüm hazır listeleri. */
export type KategoriIcerigi = {
  /** categories tablosundaki slug */
  kategori: string;
  listeler: ListeTaslagi[];
};
