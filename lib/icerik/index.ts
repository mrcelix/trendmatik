import type { KategoriIcerigi } from "./tipler";
import { mekan } from "./mekan";
import { urun } from "./urun";
import { konu } from "./konu";
import { hizmet } from "./hizmet";
import { website } from "./website";
import { haber } from "./haber";

export type { KategoriIcerigi, ListeTaslagi } from "./tipler";

/**
 * Hazır liste kütüphanesi.
 * Yönetim panelinden toplu yüklenir; var olan slug'lar atlanır, bu yüzden
 * tekrar tekrar çalıştırmak güvenlidir.
 */
export const HAZIR_ICERIK: KategoriIcerigi[] = [
  mekan,
  urun,
  konu,
  hizmet,
  website,
  haber,
];

export function icerikOzeti(): { kategori: string; liste: number; madde: number }[] {
  return HAZIR_ICERIK.map((k) => ({
    kategori: k.kategori,
    liste: k.listeler.length,
    madde: k.listeler.reduce((t, l) => t + l.m.length, 0),
  }));
}
