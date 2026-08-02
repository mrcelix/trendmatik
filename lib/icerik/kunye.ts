/**
 * Doğrulanmış resmî site adresleri.
 *
 * Buradaki her adres canlı olarak istek atılarak doğrulandı: alan adı
 * çözülüyor, TLS kuruluyor ve sunucu beklenen alan adından yanıt veriyor.
 * Ezberden yazılmış, doğrulanmamış hiçbir adres eklenmedi.
 *
 * Bot koruması (403) nedeniyle doğrulanamayan markalar bilerek DIŞARIDA
 * bırakıldı — yanlış bağlantı vermektense boş bırakmak yeğdir. Onlar
 * yönetim panelinden elle girilebilir.
 *
 * Not: üç marka artık başka adrese yönleniyor ve bu gerçek sahiplik
 * değişikliklerini yansıtıyor:
 *   AnadoluJet → ajet.com, MNG Kargo → DHL eCommerce, Kamil Koç → FlixBus
 *
 * Anahtar, madde adıyla birebir eşleşmeli (items.name).
 */
export const DOGRULANMIS_SITELER: Record<string, string> = {
  // Yeme-içme
  "Kahve Dünyası": "https://www.kahvedunyasi.com",
  "Kronotrop": "https://www.kronotrop.com.tr",
  "Starbucks": "https://www.starbucks.com.tr",
  "Mado": "https://www.mado.com.tr",

  // Market ve perakende
  "Migros": "https://www.migros.com.tr",
  "BİM": "https://www.bim.com.tr",
  "ŞOK": "https://www.sokmarket.com.tr",
  "Koçtaş": "https://www.koctas.com.tr",
  "Vatan Bilgisayar": "https://www.vatanbilgisayar.com",
  "MediaMarkt": "https://www.mediamarkt.com.tr",
  "D&R": "https://www.dr.com.tr",
  "Kitapyurdu": "https://www.kitapyurdu.com",
  "Boyner": "https://www.boyner.com.tr",

  // E-ticaret ve teslimat
  "Amazon Türkiye": "https://www.amazon.com.tr",
  "Hepsiburada": "https://www.hepsiburada.com",
  "Yemeksepeti": "https://www.yemeksepeti.com",
  "Getir": "https://www.getir.com",

  // Operatör
  "Turkcell": "https://www.turkcell.com.tr",
  "Vodafone Türkiye": "https://www.vodafone.com.tr",
  "Türk Telekom": "https://www.turktelekom.com.tr",

  // Kargo
  "Yurtiçi Kargo": "https://www.yurticikargo.com",
  "Aras Kargo": "https://www.araskargo.com.tr",
  "Sürat Kargo": "https://www.suratkargo.com.tr",
  "MNG Kargo": "https://www.mngkargo.com.tr",

  // Banka ve finans
  "Garanti BBVA": "https://www.garantibbva.com.tr",
  "İş Bankası": "https://www.isbank.com.tr",
  "Akbank": "https://www.akbank.com",
  "Yapı Kredi": "https://www.yapikredi.com.tr",
  "Ziraat Bankası": "https://www.ziraatbank.com.tr",
  "QNB Finansbank": "https://www.qnb.com.tr",
  "DenizBank": "https://www.denizbank.com",
  "Halkbank": "https://www.halkbank.com.tr",
  "VakıfBank": "https://www.vakifbank.com.tr",
  "iyzico": "https://www.iyzico.com",
  "BtcTurk": "https://www.btcturk.com",
  "Paribu": "https://www.paribu.com",

  // Ulaşım
  "Türk Hava Yolları": "https://www.turkishairlines.com",
  "AnadoluJet": "https://www.anadolujet.com",
  "Metro Turizm": "https://www.metroturizm.com.tr",
  "Kamil Koç": "https://www.kamilkoc.com.tr",
  "Enuygun": "https://www.enuygun.com",
  "Biletix": "https://www.biletix.com",

  // Beyaz eşya ve üretim
  "Arçelik": "https://www.arcelik.com.tr",
  "Beko": "https://www.beko.com.tr",
  "Vestel": "https://www.vestel.com.tr",
  "Çaykur": "https://www.caykur.gov.tr",

  // Kamu ve sağlık
  "e-Devlet Kapısı": "https://www.turkiye.gov.tr",
  "MHRS": "https://www.mhrs.gov.tr",
  "e-Nabız": "https://enabiz.gov.tr",

  // Medya ve hizmet
  "Anadolu Ajansı": "https://www.aa.com.tr",
  "Webrazzi": "https://webrazzi.com",
  "Kariyer.net": "https://www.kariyer.net",
  "Armut": "https://www.armut.com",
  "Şikayetvar": "https://www.sikayetvar.com",
};
