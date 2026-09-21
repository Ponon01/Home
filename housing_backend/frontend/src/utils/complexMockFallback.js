import { getExcelDefaults } from "./complexExcelDefaults";

/** 15 канонических ЖК (совпадает с backend CANONICAL_COMPLEXES). */
export const CANONICAL_COMPLEX_SEEDS = [
  { id: 1, name: "Лазурный квартал", district: "Есильский район", address: "ул. Сарайшык 5", build_year: 2018, entrances: 2 },
  { id: 2, name: "Сармат", district: "Есильский район", address: "ул. Сауран 3/1", build_year: 2019, entrances: 2 },
  { id: 3, name: "Зерде", district: "Алматинский район", address: "пр. Шакарим Кудайбердыулы 4", build_year: 2017, entrances: 1 },
  { id: 4, name: "Москва", district: "Сарыаркинский район", address: "ул. Иманова 17", build_year: 2015, entrances: 1 },
  { id: 5, name: "Виктория", district: "Алматинский район", address: "пр. Бауыржан Момышулы 2", build_year: 2016, entrances: 2 },
  { id: 6, name: "Жагалау-3", district: "район Нура", address: "ул. Чингиз Айтматов 36", build_year: 2020, entrances: 2 },
  { id: 7, name: "НУР-САЯ", district: "Есильский район", address: "ул. Достык 13/2", build_year: 2021, entrances: 1 },
  { id: 8, name: "Общежитие", district: "Сарыаркинский район", address: "пр. Республики 81", build_year: 2012, entrances: 3 },
  { id: 9, name: "Сапа-2007", district: "Сарыаркинский район", address: "ул. Шаймерден Косшыгулулы 7", build_year: 2007, entrances: 3 },
  { id: 10, name: "Хан-тенгри", district: "район Байконур", address: "ул. Сембинова 7", build_year: 2019, entrances: 1 },
  { id: 11, name: "Акку", district: "район Нура", address: "ул. Култегин 5", build_year: 2018, entrances: 2 },
  { id: 12, name: "ул. К. Азирбаева", district: "район Сарайшык", address: "ул. Кенен Азирбаева 6/2", build_year: 2022, entrances: 1 },
  { id: 13, name: "Браво", district: "район Сарайшык", address: "ул. Шамши Калдаякова 17", build_year: 2020, entrances: 1 },
  { id: 14, name: "Compass North", district: "район Сарайшык", address: "ул. Шамши Калдаякова 58/1", build_year: 2023, entrances: 1 },
  { id: 15, name: "Respublika", district: "Есильский район", address: "ул. Е 36 дом 5", build_year: 2021, entrances: 2 },
];

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Локальный каталог ЖК в формате API `/housing-fund/complexes`. */
export function buildFallbackComplexes() {
  return CANONICAL_COMPLEX_SEEDS.map((seed) => {
    const excel = getExcelDefaults(seed.name) || {};
    const total = safeInt(excel.total);
    const sold = safeInt(excel.sold);
    const rent = safeInt(excel.rent);
    const guest = safeInt(excel.guest);
    const remaining = safeInt(excel.remaining);
    const forSale = safeInt(excel.forSale);
    const installment = Math.max(forSale - sold, 0);

    return {
      id: seed.id,
      name: seed.name,
      address: excel.address || seed.address,
      district: excel.district || seed.district,
      build_year: seed.build_year ?? null,
      entrances: seed.entrances ?? null,
      image_path: null,
      total_count: total,
      rent_count: rent,
      installment_count: installment,
      sold_count: sold,
      guest_count: guest,
      free_count: remaining,
      rent_as_flat: safeInt(excel.rent_as_flat, rent),
      rent_as_dorm: safeInt(excel.rent_as_dorm),
      dorm_flats_info: excel.dorm_flats_info || null,
      not_for_sale_count: safeInt(excel.notForSale),
      for_sale_count: forSale,
      _fallback: true,
    };
  });
}

/** Нормализует ответ API (массив или обёртка). */
export function normalizeComplexesResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.rows)) return data.rows;
  if (data && Array.isArray(data.complexes)) return data.complexes;
  return null;
}
