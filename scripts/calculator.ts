// ─────────────────────────────────────────────────────────────────────────────
//  Расчёт устойчивости стержней по СП 16.13330.2017
//  Архитектура: классы + Map, функциональный стиль, без глобального состояния.
//  calculateStability() возвращает { error: string } с i18n-ключом или CalcResult.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Константы ────────────────────────────────────────────────────────────────

/** Модуль упругости стали, МПа */
export const E = 2.06e5;

// ─── Типы ─────────────────────────────────────────────────────────────────────

export type SectionType = "a" | "b" | "c";

export interface SteelRange {
  min: number;
  max: number;
  ry: number;
}

export interface LmpResult {
  /** Ограниченная гибкость [10, 120] */
  lambda: number;
  /** Условная гибкость λ̄ */
  lambdaBar: number;
}

export interface CalcResult {
  phi: number;
  ry: number;
  ryPa: number;
  lambdaBar: number;
  area: number;
  force: number;
  denominator: number;
  ratio: number;
  isStable: boolean;
  yc: number;
}

export interface CalcError {
  error: string;
}

// ─── Таблицы коэффициентов φ ──────────────────────────────────────────────────

/** Пара [условная гибкость, φ] */
type PhiEntry = readonly [number, number];

const PHI_TABLE_A: readonly PhiEntry[] = [
  [0.4, 1.000], [0.6, 0.994], [0.8, 0.981], [1.0, 0.968],
  [1.2, 0.953], [1.4, 0.938], [1.6, 0.920], [1.8, 0.900],
  [2.0, 0.877], [2.2, 0.851], [2.4, 0.821], [2.6, 0.786],
  [2.8, 0.747], [3.0, 0.704], [3.2, 0.660], [3.4, 0.616],
  [3.6, 0.572], [3.8, 0.526], [4.0, 0.475], [4.2, 0.431],
  [4.4, 0.393], [4.6, 0.359], [4.8, 0.330], [5.0, 0.304],
  [5.2, 0.281], [5.4, 0.261], [5.6, 0.242],
];

const PHI_TABLE_B: readonly PhiEntry[] = [
  [0.4, 1.000], [0.6, 0.986], [0.8, 0.967], [1.0, 0.948],
  [1.2, 0.927], [1.4, 0.905], [1.6, 0.881], [1.8, 0.855],
  [2.0, 0.826], [2.2, 0.794], [2.4, 0.760], [2.6, 0.723],
  [2.8, 0.683], [3.0, 0.643], [3.2, 0.602], [3.4, 0.562],
  [3.6, 0.524], [3.8, 0.487], [4.0, 0.453], [4.2, 0.422],
  [4.4, 0.392], [4.6, 0.359], [4.8, 0.330], [5.0, 0.304],
  [5.2, 0.281], [5.4, 0.261], [5.6, 0.242], [5.8, 0.226],
  [6.0, 0.211],
];

const PHI_TABLE_C: readonly PhiEntry[] = [
  [0.4, 0.984], [0.6, 0.956], [0.8, 0.929], [1.0, 0.901],
  [1.2, 0.872], [1.4, 0.842], [1.6, 0.811], [1.8, 0.778],
  [2.0, 0.744], [2.2, 0.709], [2.4, 0.672], [2.6, 0.635],
  [2.8, 0.598], [3.0, 0.562], [3.2, 0.527], [3.4, 0.493],
  [3.6, 0.460], [3.8, 0.430], [4.0, 0.402], [4.2, 0.375],
  [4.4, 0.351], [4.6, 0.329], [4.8, 0.308], [5.0, 0.289],
  [5.2, 0.271], [5.4, 0.255], [5.6, 0.241], [5.8, 0.241],
];

/** Общая таблица для λ̄ > max(основной таблицы) и ≤ 10 */
const PHI_TABLE_HIGH: readonly PhiEntry[] = [
  [6.2, 0.198], [6.4, 0.186], [6.6, 0.174], [6.8, 0.164],
  [7.0, 0.155], [7.2, 0.147], [7.4, 0.139], [7.6, 0.132],
  [7.8, 0.125], [8.0, 0.119], [8.5, 0.105], [9.0, 0.094],
  [9.5, 0.084], [10.0, 0.076],
];

/** Индекс таблиц φ по типу сечения */
const PHI_TABLES: ReadonlyMap<SectionType, readonly PhiEntry[]> = new Map([
  ["a", PHI_TABLE_A],
  ["b", PHI_TABLE_B],
  ["c", PHI_TABLE_C],
]);

// ─── Данные марок стали ───────────────────────────────────────────────────────

/** Реестр диапазонов толщин и расчётных сопротивлений (СП 16.13330.2017) */
const STEEL_REGISTRY: ReadonlyMap<string, readonly SteelRange[]> = new Map([
  ["C235",   [{ min: 0,   max: 4,   ry: 230 }]],
  ["C245",   [{ min: 0,   max: 20,  ry: 240 }]],
  ["C255",   [
    { min: 0,  max: 3.9, ry: 250 },
    { min: 4,  max: 10,  ry: 240 },
    { min: 10, max: 20,  ry: 240 },
  ]],
  ["C345",   [
    { min: 0,  max: 10,  ry: 340 },
    { min: 10, max: 20,  ry: 320 },
    { min: 20, max: 40,  ry: 300 },
    { min: 40, max: 60,  ry: 280 },
    { min: 60, max: 80,  ry: 270 },
  ]],
  ["C345K",  [{ min: 4,   max: 160, ry: 340 }]],
  ["C355",   [
    { min: 8,   max: 16,  ry: 350 },
    { min: 16,  max: 40,  ry: 340 },
    { min: 40,  max: 60,  ry: 330 },
    { min: 60,  max: 80,  ry: 320 },
    { min: 80,  max: 100, ry: 310 },
    { min: 100, max: 160, ry: 295 },
  ]],
  ["C355-1", [
    { min: 8,  max: 16, ry: 350 },
    { min: 16, max: 40, ry: 340 },
    { min: 40, max: 50, ry: 330 },
  ]],
  ["C390",   [
    { min: 8,  max: 16, ry: 380 },
    { min: 16, max: 40, ry: 340 },
  ]],
  ["C440",   [{ min: 8, max: 50,  ry: 430 }]],
  ["C590",   [{ min: 8, max: 50,  ry: 525 }]],
  ["C690",   [{ min: 8, max: 50,  ry: 575 }]],
]);

// ─── Вспомогательные функции ──────────────────────────────────────────────────

/**
 * Линейная интерполяция по таблице вида [[x, y], ...].
 * Возвращает крайние значения при выходе за границы.
 */
export function interpolate(table: readonly PhiEntry[], x: number): number {
  const first = table[0];
  const last = table[table.length - 1];

  if (x <= first[0]) return first[1];
  if (x >= last[0])  return last[1];

  // Бинарный поиск интервала
  let lo = 0;
  let hi = table.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table[mid + 1][0] < x) lo = mid + 1;
    else hi = mid;
  }

  const [x1, y1] = table[lo];
  const [x2, y2] = table[lo + 1];
  return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
}

/**
 * Расчётное сопротивление стали Ry (МПа) по марке и толщине проката.
 * Возвращает null, если марка неизвестна или толщина вне допустимых диапазонов.
 */
export function getRy(grade: string, thickness: number): number | null {
  const ranges = STEEL_REGISTRY.get(grade);
  if (!ranges) return null;

  const match = ranges.find(r => thickness >= r.min && thickness <= r.max);
  return match?.ry ?? null;
}

/**
 * Условная гибкость λ̄ = λ_clamped × √(Ry / E).
 * λ_clamped = clamp(λ, 10, 120).
 */
export function computeLambdaBar(lambda: number, ry: number): LmpResult | null {
  if (!isFinite(lambda) || lambda <= 0) return null;

  const lambdaClamped = Math.min(120, Math.max(10, lambda));
  return {
    lambda: lambdaClamped,
    lambdaBar: lambdaClamped * Math.sqrt(ry / E),
  };
}

/**
 * Коэффициент продольного изгиба φ по типу сечения и λ̄.
 */
export function computePhi(sectionType: SectionType, lambdaBar: number): number | null {
  // λ̄ < 0.4 → φ = 1 (упругая работа без снижения)
  if (lambdaBar < 0.4) return 1.0;

  // λ̄ > 10 → формула Эйлера в нормированном виде
  if (lambdaBar > 10.0) return 7.6 / (lambdaBar * lambdaBar);

  const baseTable = PHI_TABLES.get(sectionType);
  if (!baseTable) return null;

  const baseMax = baseTable[baseTable.length - 1][0];

  if (lambdaBar <= baseMax) return interpolate(baseTable, lambdaBar);

  // λ̄ выше максимума основной таблицы, но ≤ 10 — сшиваем с PHI_TABLE_HIGH
  const highMin = PHI_TABLE_HIGH[0][0];
  if (lambdaBar < highMin) {
    // Линейная интерполяция между концом основной таблицы и началом PHI_HIGH
    const x1 = baseMax;
    const y1 = baseTable[baseTable.length - 1][1];
    const [x2, y2] = PHI_TABLE_HIGH[0];
    return y1 + (y2 - y1) * (lambdaBar - x1) / (x2 - x1);
  }

  return interpolate(PHI_TABLE_HIGH, lambdaBar);
}

/**
 * Форматирование числа: обычная запись или научная нотация через HTML-тег <sup>.
 */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return "0";

  if (abs >= 10_000 || abs < 0.001) {
    const exp = Math.floor(Math.log10(abs));
    const coeff = (value / 10 ** exp).toFixed(4);
    return `${coeff} × 10<sup>${exp}</sup>`;
  }

  return value.toFixed(6);
}

// ─── Основной расчёт ──────────────────────────────────────────────────────────

/**
 * Проверка условия устойчивости: N / (φ · A · Ry · γc) ≤ 1.
 *
 * @param grade       Марка стали (например, "C345")
 * @param thickness   Толщина проката, мм
 * @param lambda      Гибкость стержня λ (10 … 120)
 * @param yc          Коэффициент условий работы γc
 * @param areaSI      Площадь сечения, м²
 * @param forceSI     Продольное усилие N, Н
 * @param sectionType Тип сечения: "a" | "b" | "c"
 *
 * @returns CalcResult при успехе или CalcError с i18n-ключом при ошибке.
 */
export function calculateStability(
  grade: string,
  thickness: number,
  lambda: number,
  yc: number,
  areaSI: number,
  forceSI: number,
  sectionType: SectionType,
): CalcResult | CalcError {
  // Валидация входных данных
  const guards: Array<[boolean, string]> = [
    [!isFinite(thickness) || thickness <= 0,                       "err-thickness"],
    [!isFinite(lambda)    || lambda < 10 || lambda > 120,          "err-lambda"],
    [!isFinite(areaSI)    || areaSI <= 0 || !isFinite(forceSI) || forceSI <= 0, "err-area"],
  ];

  for (const [fail, key] of guards) {
    if (fail) return { error: key };
  }

  const ry = getRy(grade, thickness);
  if (ry === null) return { error: "err-grade" };

  const lmpResult = computeLambdaBar(lambda, ry);
  if (!lmpResult) return { error: "err-lmp" };

  const phi = computePhi(sectionType, lmpResult.lambdaBar);
  if (phi === null) return { error: "err-phi" };

  const ryPa        = ry * 1e6;
  const denominator = phi * areaSI * ryPa * yc;
  const ratio       = forceSI / denominator;

  return {
    phi,
    ry,
    ryPa,
    lambdaBar: lmpResult.lambdaBar,
    area:      areaSI,
    force:     forceSI,
    denominator,
    ratio,
    isStable:  ratio <= 1,
    yc,
  };
}

// ─── Обратная совместимость ───────────────────────────────────────────────────
// Псевдонимы старых имён для плавной миграции без правки UI-кода.

/** @deprecated Используйте PHI_TABLE_A */
export const PHI_A = PHI_TABLE_A;
/** @deprecated Используйте PHI_TABLE_B */
export const PHI_B = PHI_TABLE_B;
/** @deprecated Используйте PHI_TABLE_C */
export const PHI_C = PHI_TABLE_C;
/** @deprecated Используйте PHI_TABLE_HIGH */
export const PHI_HIGH = PHI_TABLE_HIGH;
/** @deprecated Используйте STEEL_REGISTRY */
export const STEEL_DATA = Object.fromEntries(STEEL_REGISTRY);
/** @deprecated Используйте computeLambdaBar() */
export const calculateLmp = (lambda: number, ry: number) => {
  const r = computeLambdaBar(lambda, ry);
  return r ? { lm: r.lambda, lmp: r.lambdaBar } : null;
};
/** @deprecated Используйте computePhi() */
export const getPhi = computePhi;