// ================================================================
// UA → ES route template (середа, 16:00 з Чернівців)
// ================================================================
// Використовується кнопкою «Імпортувати шаблон» у RoutesTab для швидкого
// заповнення порожнього тенанта: 23 точки + матриця цін з реверсом.
//
// Джерело даних — оригінальні shortlinks Google Maps від замовника.
// Координати витягнуті розгортанням посилань на етапі розробки.
//
// ПРИМІТКА: тип DeliveryMode навмисно продубльовано інлайном (а не
// імпортовано з ../api/routes), щоб уникнути циклічної залежності —
// api/routes.ts імпортує цей шаблон у value-формі.

export interface TemplatePoint {
  name_ua: string;
  country_code: string;
  sort_order: number;
  location_name: string | null;
  lat: number | null;
  lon: number | null;
  maps_url: string | null;
  delivery_mode: 'point' | 'address_and_point';
}

export interface TemplatePriceRule {
  from: string;
  to: string;
  price: number;
  reverse?: boolean; // default true — створити дзеркальне правило
}

export const UA_ES_TEMPLATE: {
  points: TemplatePoint[];
  prices: TemplatePriceRule[];
} = {
  points: [
    { name_ua: 'Чернівці',   country_code: 'UA', sort_order: 1,  location_name: 'Центральний Автовокзал', lat: 48.264973, lon: 25.951929, maps_url: 'https://maps.app.goo.gl/1DnniH61uU5QKCKRA', delivery_mode: 'point' },
    { name_ua: 'Сучава',     country_code: 'RO', sort_order: 2,  location_name: null,                     lat: null,       lon: null,       maps_url: null,                                         delivery_mode: 'point' },
    { name_ua: 'Братислава', country_code: 'SK', sort_order: 3,  location_name: 'ORLEN',                  lat: 48.181325, lon: 17.054571, maps_url: 'https://maps.app.goo.gl/Ynu84ZxBHkdoDHqM8', delivery_mode: 'point' },
    { name_ua: 'Брно',       country_code: 'CZ', sort_order: 4,  location_name: 'OMV',                    lat: 49.17434,  lon: 16.51295,  maps_url: 'https://maps.app.goo.gl/HkJjDxmxpS9m5iSs6', delivery_mode: 'point' },
    { name_ua: 'Прага',      country_code: 'CZ', sort_order: 5,  location_name: 'ORLEN',                  lat: 50.033641, lon: 14.214376, maps_url: 'https://maps.app.goo.gl/VcdYViqiJ7vBYFDA8', delivery_mode: 'point' },
    { name_ua: 'Нюрнберг',   country_code: 'DE', sort_order: 6,  location_name: 'Nürnberg',               lat: 49.454288, lon: 11.074564, maps_url: 'https://maps.app.goo.gl/8wFmrmrmYnTEEyXt6', delivery_mode: 'point' },
    { name_ua: 'Карлсруе',   country_code: 'DE', sort_order: 7,  location_name: 'Karlsruhe',              lat: 49.006890, lon: 8.403653,  maps_url: 'https://maps.app.goo.gl/5SHCvCpjbq2DnukMA', delivery_mode: 'point' },
    { name_ua: 'Жерона',     country_code: 'ES', sort_order: 8,  location_name: 'Repsol',                 lat: 42.173453, lon: 2.930165,  maps_url: 'https://maps.app.goo.gl/hACMpXvRBqJqHCey8', delivery_mode: 'point' },
    { name_ua: 'Барселона',  country_code: 'ES', sort_order: 9,  location_name: 'bp',                     lat: 41.493019, lon: 2.099212,  maps_url: 'https://maps.app.goo.gl/4Edu9VxFPuqN2ngh6', delivery_mode: 'point' },
    { name_ua: 'Тарагона',   country_code: 'ES', sort_order: 10, location_name: 'Tarragona',              lat: 41.118883, lon: 1.244491,  maps_url: 'https://maps.app.goo.gl/gLFbMZSBXBxkwLXCA', delivery_mode: 'point' },
    { name_ua: 'Тортоса',    country_code: 'ES', sort_order: 11, location_name: 'Campo Quality',          lat: 40.755046, lon: 0.600016,  maps_url: 'https://maps.app.goo.gl/WNv4cSFnbtooRDE59', delivery_mode: 'point' },
    { name_ua: 'Валенсія',   country_code: 'ES', sort_order: 12, location_name: 'Galp',                   lat: 39.400600, lon: -0.493606, maps_url: 'https://maps.app.goo.gl/w8xMkFLdLXAXvL697', delivery_mode: 'point' },
    { name_ua: 'Бенідорм',   country_code: 'ES', sort_order: 13, location_name: 'Cepsa',                  lat: 38.535972, lon: -0.202250, maps_url: 'https://maps.app.goo.gl/w39jaTkkh5Q3986r9', delivery_mode: 'address_and_point' },
    { name_ua: 'Аліканте',   country_code: 'ES', sort_order: 14, location_name: 'Avanza',                 lat: 38.383569, lon: -0.489813, maps_url: 'https://maps.app.goo.gl/uBqLymLwiip93S1V8', delivery_mode: 'point' },
    { name_ua: 'Торревеха',  country_code: 'ES', sort_order: 15, location_name: 'Repsol',                 lat: 38.233350, lon: -0.790679, maps_url: 'https://maps.app.goo.gl/5ULGurVdCbcxx9VV8', delivery_mode: 'point' },
    { name_ua: 'Мурсія',     country_code: 'ES', sort_order: 16, location_name: 'Repsol',                 lat: 38.102594, lon: -1.035301, maps_url: 'https://maps.app.goo.gl/u8Qti8AYxgbxVKUW6', delivery_mode: 'point' },
    { name_ua: 'Алмеріа',    country_code: 'ES', sort_order: 17, location_name: 'Repsol',                 lat: 36.875419, lon: -2.337874, maps_url: 'https://maps.app.goo.gl/yXctG6nfcaN6A8gn7', delivery_mode: 'point' },
    { name_ua: 'Мотріль',    country_code: 'ES', sort_order: 18, location_name: 'Cepsa',                  lat: 36.770238, lon: -3.556822, maps_url: 'https://maps.app.goo.gl/9ZYkCcoZjnr4s63aA', delivery_mode: 'point' },
    { name_ua: 'Малага',     country_code: 'ES', sort_order: 19, location_name: 'Mercadillo de Huelin',   lat: 36.703111, lon: -4.445077, maps_url: 'https://maps.app.goo.gl/Gwnb6SgWEaN7vdHA8', delivery_mode: 'address_and_point' },
    { name_ua: 'Фуенхерола', country_code: 'ES', sort_order: 20, location_name: 'Autolavado 24h',         lat: 36.546434, lon: -4.633475, maps_url: 'https://maps.app.goo.gl/Z8ySfjZaQYZz4nH98', delivery_mode: 'address_and_point' },
    { name_ua: 'Марбея',     country_code: 'ES', sort_order: 21, location_name: 'Shell',                  lat: 36.520024, lon: -4.891923, maps_url: 'https://maps.app.goo.gl/pbFjxkYuZFXR1m6J9', delivery_mode: 'address_and_point' },
    { name_ua: 'Сан-Педро',  country_code: 'ES', sort_order: 22, location_name: 'CEPSA',                  lat: 36.479993, lon: -4.993067, maps_url: 'https://maps.app.goo.gl/Voh7LMBihXKgchecA', delivery_mode: 'address_and_point' },
    { name_ua: 'Естепона',   country_code: 'ES', sort_order: 23, location_name: 'Cepsa',                  lat: 36.431556, lon: -5.12350,  maps_url: 'https://maps.app.goo.gl/7V9VibZWznHFjJLS8', delivery_mode: 'address_and_point' },
  ],

  // Правила цін з тексту замовника. `reverse` за замовчуванням true — кожне
  // правило дзеркалиться (Чернівці→Малага = Малага→Чернівці = 200 EUR).
  prices: buildPriceRules(),
};

function buildPriceRules(): TemplatePriceRule[] {
  const rules: TemplatePriceRule[] = [];

  // Чернівці → Нюрнберг/Карлсруе: 150 EUR
  const chv150 = ['Нюрнберг', 'Карлсруе'];
  for (const to of chv150) rules.push({ from: 'Чернівці', to, price: 150 });

  // Чернівці → весь іспанський блок: 200 EUR
  const esBlock = [
    'Жерона', 'Барселона', 'Тарагона', 'Тортоса', 'Валенсія',
    'Бенідорм', 'Аліканте', 'Торревеха', 'Мурсія', 'Алмеріа',
    'Мотріль', 'Малага', 'Фуенхерола', 'Марбея', 'Сан-Педро', 'Естепона',
  ];
  for (const to of esBlock) rules.push({ from: 'Чернівці', to, price: 200 });

  // EU-хаби → іспанський блок: 150 EUR
  const euOrigins = ['Братислава', 'Брно', 'Прага', 'Нюрнберг', 'Карлсруе'];
  for (const from of euOrigins) {
    for (const to of esBlock) rules.push({ from, to, price: 150 });
  }

  return rules;
}
