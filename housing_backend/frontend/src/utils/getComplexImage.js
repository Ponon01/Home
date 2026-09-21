/** Базовый путь к статическим фото ЖК в `public/complexes/`. */
export const COMPLEX_IMAGES_BASE = "/complexes";

/** Готовый список файлов в `public/complexes/`. */
export const COMPLEX_IMAGE_FILES = [
  "akku.png",
  "bravo.png",
  "compass-north.png",
  "kenen-azerbaeva.png",
  "khan-tengri.png",
  "lazurka.png",
  "moskva.png",
  "nursaya.png",
  "respublika.png",
  "respublika-81.png",
  "sapa.png",
  "sarmat.png",
  "victoriya.png",
  "zerde.png",
  "zhagalau.png",
];

const DEFAULT_FILE = "lazurka.png";

/**
 * Дефолтное фото ЖК из `public/complexes/` по названию комплекса.
 * Всегда возвращает путь вида `/complexes/{fileName}.png` из готового списка.
 */
export const getComplexImage = (name) => {
  const n = String(name || "").toLowerCase();

  let file = DEFAULT_FILE;

  if (n.includes("жагалау") || n.includes("zhagalau")) file = "zhagalau.png";
  else if (n.includes("акку") || n.includes("аққу") || n.includes("akku")) file = "akku.png";
  else if (n.includes("браво") || n.includes("bravo")) file = "bravo.png";
  else if (n.includes("виктория") || n.includes("victoriya") || n.includes("viktoriya"))
    file = "victoriya.png";
  else if (n.includes("зерде") || n.includes("zerde")) file = "zerde.png";
  else if (n.includes("кенен") || n.includes("азирбаев") || n.includes("азерб") || n.includes("kenen"))
    file = "kenen-azerbaeva.png";
  else if (n.includes("компас") || n.includes("compass")) file = "compass-north.png";
  else if (n.includes("лазур") || n.includes("lazur")) file = "lazurka.png";
  else if (n.includes("москва") || n.includes("moskva") || n.includes("moscow")) file = "moskva.png";
  else if (
    n.includes("нурсая") ||
    n.includes("нұрсая") ||
    n.includes("nursaya") ||
    (n.includes("нур") && n.includes("сая"))
  )
    file = "nursaya.png";
  else if (
    n.includes("республика 81") ||
    n.includes("республики 81") ||
    n.includes("respublika-81") ||
    n.includes("общежитие")
  )
    file = "respublika-81.png";
  else if (n.includes("республика") || n.includes("respublika")) file = "respublika.png";
  else if (n.includes("сапа") || n.includes("sapa") || n.includes("сити") || n.includes("сана"))
    file = "sapa.png";
  else if (n.includes("сармат") || n.includes("sarmat")) file = "sarmat.png";
  else if (
    n.includes("хан тенгри") ||
    n.includes("хан-тенгри") ||
    n.includes("хан тәңірі") ||
    n.includes("khan-tengri") ||
    n.includes("khan tengri")
  )
    file = "khan-tengri.png";

  if (!COMPLEX_IMAGE_FILES.includes(file)) file = DEFAULT_FILE;
  return `${COMPLEX_IMAGES_BASE}/${file}`;
};
