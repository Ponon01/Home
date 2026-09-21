/** Локализация карточки квартиры (Русский / Қазақша). */

export const HOUSING_CARD_LANGS = {
  ru: "ru",
  kk: "kk",
};

const DICT = {
  ru: {
    apartmentCard: "Карточка квартиры",
    complexPrefix: "Жилой комплекс",
    complexFallback: "Жилой комплекс",
    apartmentTitle: "Квартира {n}",
    entranceFloor: "• {entrance} подъезд, {floor} этаж",
    entrance: "Подъезд",
    floor: "Этаж",
    area: "Общая площадь",
    personalAccount: "Лицевой счет",
    personalAccountNo: "№ {n}",
    status: "Статус",
    usageFormat: "Формат использования",
    usageFamily: "Квартира (1 семья)",
    usageDorm: "Общежитие (Подселение)",
    usageGuest: "Гостевой фонд",
    livesCount: "Проживает",
    livesCountValue: "Проживает: {n} чел.",
    residents: "Проживающие",
    vacant: "Квартира свободна",
    residentDocs: "📁 Документы жильца",
    history: "История проживания",
    current: "Текущий",
    archive: "Архив",
    close: "Закрыть",
    fullName: "ФИО",
    position: "Должность",
    department: "Отдел",
    contractType: "Вид договора",
    contract: "Договор",
    monthlyPayment: "Ежемесячная оплата",
    upload: "Загрузить",
    view: "Просмотреть",
    download: "Скачать",
    fileMissing: "Файл не загружен",
    uploadFailed: "Не удалось загрузить файл",
    loadFailed: "Не удалось загрузить карточку квартиры",
    room: "Комната",
    sqm: "кв.м",
    person1: "1 чел.",
    personFew: "{n} чел.",
    personMany: "{n} чел.",
    occupants: "Проживающие",
    occupant: "Проживающий",
    statusRent: "🟡 Аренда",
    statusFree: "🟢 Свободно",
    statusGuest: "🟣 Гостевая",
    statusInstallment: "🔵 Рассрочка",
    statusSold: "🔴 Выкуп",
    cardApartment: "Квартира {n}",
    cardDorm: "Общежитие ({n} сотр.)",
    cardDormHint: "{n} жильца",
    cardDormHintOne: "1 жилец",
    cardDormHintMany: "{n} жильцов",
    cardFree: "Свободно",
    cardEmpty: "Пустая",
    navHome: "На главную",
    navDepartments: "Департаменты",
    logout: "Выйти",
    empty: "—",
  },
  kk: {
    apartmentCard: "Пәтер карточкасы",
    complexPrefix: "Тұрғын үй кешені",
    complexFallback: "Тұрғын үй кешені",
    apartmentTitle: "Пәтер {n}",
    entranceFloor: "• {entrance} кіреберіс, {floor} қабат",
    entrance: "Кіреберіс",
    floor: "Қабат",
    area: "Жалпы аудан",
    personalAccount: "Жеке шот",
    personalAccountNo: "№ {n}",
    status: "Мәртебе",
    usageFormat: "Пайдалану форматы",
    usageFamily: "Пәтер (1 отбасы)",
    usageDorm: "Жатақхана (Бірге тұру)",
    usageGuest: "Қонақ қоры",
    livesCount: "Тұрады",
    livesCountValue: "Тұрады: {n} адам",
    residents: "Тұрғындар",
    vacant: "Пәтер бос",
    residentDocs: "📁 Тұрғынның құжаттары",
    history: "Тұру тарихы",
    current: "Ағымдағы",
    archive: "Мұрағат",
    close: "Жабу",
    fullName: "Аты-жөні",
    position: "Лауазымы",
    department: "Бөлім",
    contractType: "Шарт түрі",
    contract: "Шарт",
    monthlyPayment: "Ай сайынғы төлем",
    upload: "Жүктеу",
    view: "Қарау",
    download: "Жүктеп алу",
    fileMissing: "Файл жүктелмеген",
    uploadFailed: "Файлды жүктеу мүмкін болмады",
    loadFailed: "Пәтер карточкасын жүктеу мүмкін болмады",
    room: "Бөлме",
    sqm: "ш.м",
    person1: "1 адам",
    personFew: "{n} адам",
    personMany: "{n} адам",
    occupants: "Тұрғындар",
    occupant: "Тұрғын",
    statusRent: "🟡 Жалдау",
    statusFree: "🟢 Бос",
    statusGuest: "🟣 Қонақ",
    statusInstallment: "🔵 Бөліп төлеу",
    statusSold: "🔴 Сатып алу",
    cardApartment: "Пәтер {n}",
    cardDorm: "Жатақхана ({n} қызметкер)",
    cardDormHint: "{n} тұрғын",
    cardDormHintOne: "1 тұрғын",
    cardDormHintMany: "{n} тұрғын",
    cardFree: "Бос",
    cardEmpty: "Бос",
    navHome: "Басты бет",
    navDepartments: "Департаменттер",
    logout: "Шығу",
    empty: "—",
  },
};
const STORAGE_KEY = "housing_card_lang";

export function getHousingCardLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "kk" || saved === "ru") return saved;
  } catch {
    /* ignore */
  }
  return "ru";
}

export function setHousingCardLang(lang) {
  const next = lang === "kk" ? "kk" : "ru";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export function tHousing(lang, key, vars = {}) {
  const table = DICT[lang] || DICT.ru;
  let text = table[key] ?? DICT.ru[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(`{${k}}`, String(v));
  });
  return text;
}

export function statusLabel(lang, statusKey) {
  const map = {
    rent: "statusRent",
    free: "statusFree",
    guest: "statusGuest",
    installment: "statusInstallment",
    sold: "statusSold",
  };
  return tHousing(lang, map[statusKey] || "statusRent");
}

export function statusLabelPlain(lang, statusKey) {
  return statusLabel(lang, statusKey).replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

export function formatPeople(lang, count) {
  if (count === 1) return tHousing(lang, "person1");
  if (count >= 2 && count <= 4) return tHousing(lang, "personFew", { n: count });
  return tHousing(lang, "personMany", { n: count });
}
