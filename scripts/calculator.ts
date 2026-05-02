// ─────────────────────────────────────────────────────────
//  Расчёт устойчивости по СП 16.13330.2017
//
//  calculateStability() возвращает i18n-ключ ошибки { error: string }
//  вместо хардкодных строк. Отображаемый текст формируется в UI через t(key).
// ─────────────────────────────────────────────────────────

export const E = 2.06e5; // Модуль упругости стали, МПа

// ─── Типы ─────────────────────────────────────────────────

export type SectionType = "a" | "b" | "c";

export interface SteelRange {
  min: number;
  max: number;
  ry: number;
}

export type SteelEntry = SteelRange | SteelRange[];

export interface LmpResult {
  lm: number;
  lmp: number;
}

export interface CalcResult {
  phi: number;
  ry: number;
  ryPa: number;
  lmp: number;
  area: number;
  force: number;
  denominator: number;
  ratio: number;
  isStable: boolean;
  yc: number;
}

/** Объект ошибки с i18n-ключом */
export interface CalcError {
  error: string;
}

// ─── Таблицы коэффициентов φ ───────────────────────────────

type PhiRow = [number, number];

export const PHI_A: PhiRow[] = [
  [0.4, 1.000], [0.6, 0.994], [0.8, 0.981], [1.0, 0.968],
  [1.2, 0.953], [1.4, 0.938], [1.6, 0.920], [1.8, 0.900],
  [2.0, 0.877], [2.2, 0.851], [2.4, 0.821], [2.6, 0.786],
  [2.8, 0.747], [3.0, 0.704], [3.2, 0.660], [3.4, 0.616],
  [3.6, 0.572], [3.8, 0.526], [4.0, 0.475], [4.2, 0.431],
  [4.4, 0.393], [4.6, 0.359], [4.8, 0.330], [5.0, 0.304],
  [5.2, 0.281], [5.4, 0.261], [5.6, 0.242],
];

export const PHI_B: PhiRow[] = [
  [0.4, 1.000], [0.6, 0.986], [0.8, 0.967], [1.0, 0.948],
  [1.2, 0.927], [1.4, 0.905], [1.6, 0.881], [1.8, 0.855],
  [2.0, 0.826], [2.2, 0.794], [2.4, 0.760], [2.6, 0.723],
  [2.8, 0.683], [3.0, 0.643], [3.2, 0.602], [3.4, 0.562],
  [3.6, 0.524], [3.8, 0.487], [4.0, 0.453], [4.2, 0.422],
  [4.4, 0.392], [4.6, 0.359], [4.8, 0.330], [5.0, 0.304],
  [5.2, 0.281], [5.4, 0.261], [5.6, 0.242], [5.8, 0.226],
  [6.0, 0.211],
];

export const PHI_C: PhiRow[] = [
  [0.4, 0.984], [0.6, 0.956], [0.8, 0.929], [1.0, 0.901],
  [1.2, 0.872], [1.4, 0.842], [1.6, 0.811], [1.8, 0.778],
  [2.0, 0.744], [2.2, 0.709], [2.4, 0.672], [2.6, 0.635],
  [2.8, 0.598], [3.0, 0.562], [3.2, 0.527], [3.4, 0.493],
  [3.6, 0.460], [3.8, 0.430], [4.0, 0.402], [4.2, 0.375],
  [4.4, 0.351], [4.6, 0.329], [4.8, 0.308], [5.0, 0.289],
  [5.2, 0.271], [5.4, 0.255], [5.6, 0.241], [5.8, 0.241],
];

export const PHI_HIGH: PhiRow[] = [
  [6.2, 0.198], [6.4, 0.186], [6.6, 0.174], [6.8, 0.164],
  [7.0, 0.155], [7.2, 0.147], [7.4, 0.139], [7.6, 0.132],
  [7.8, 0.125], [8.0, 0.119], [8.5, 0.105], [9.0, 0.094],
  [9.5, 0.084], [10.0, 0.076],
];

// ─── Данные по маркам стали (СП 16.13330.2017) ────────────

export const STEEL_DATA: Record<string, SteelEntry> = {
  C235:   { min: 0,   max: 4,   ry: 230 },
  C245:   { min: 0,   max: 20,  ry: 240 },
  C255: [
    { min: 0,   max: 3.9, ry: 250 },
    { min: 4,   max: 10,  ry: 240 },
    { min: 10,  max: 20,  ry: 240 },
  ],
  C345: [
    { min: 0,   max: 10,  ry: 340 },
    { min: 10,  max: 20,  ry: 320 },
    { min: 20,  max: 40,  ry: 300 },
    { min: 40,  max: 60,  ry: 280 },
    { min: 60,  max: 80,  ry: 270 },
  ],
  C345K:  { min: 4,   max: 160, ry: 340 },
  C355: [
    { min: 8,   max: 16,  ry: 350 },
    { min: 16,  max: 40,  ry: 340 },
    { min: 40,  max: 60,  ry: 330 },
    { min: 60,  max: 80,  ry: 320 },
    { min: 80,  max: 100, ry: 310 },
    { min: 100, max: 160, ry: 295 },
  ],
  "C355-1": [
    { min: 8,   max: 16,  ry: 350 },
    { min: 16,  max: 40,  ry: 340 },
    { min: 40,  max: 50,  ry: 330 },
  ],
  C390: [
    { min: 8,   max: 16,  ry: 380 },
    { min: 16,  max: 40,  ry: 340 },
  ],
  C440:   { min: 8,   max: 50,  ry: 430 },
  C590:   { min: 8,   max: 50,  ry: 525 },
  C690:   { min: 8,   max: 50,  ry: 575 },
};

// ─── Утилиты ──────────────────────────────────────────────

/** Линейная интерполяция по двухколоночной таблице */
export function interpolate(table: PhiRow[], value: number): number {
  if (value <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (value >= last[0]) return last[1];

  for (let i = 0; i < table.length - 1; i++) {
    const [x1, y1] = table[i];
    const [x2, y2] = table[i + 1];
    if (value >= x1 && value <= x2) {
      return y1 + (y2 - y1) * (value - x1) / (x2 - x1);
    }
  }
  return last[1]; // fallback
}

/** Возвращает Ry (МПа) или null, если толщина вне диапазона */
export function getRy(grade: string, thickness: number): number | null {
  const entry = STEEL_DATA[grade];
  if (!entry) return null;

  const ranges = Array.isArray(entry) ? entry : [entry];
  for (const r of ranges) {
    if (thickness >= r.min && thickness <= r.max) return r.ry;
  }
  return null;
}

/** Расчёт условной гибкости λ̄ = λ × √(Ry / E) */
export function calculateLmp(lambda: number, ry: number): LmpResult | null {
  if (!isFinite(lambda) || lambda <= 0 || ry === null) return null;
  const lm = Math.min(120, Math.max(10, lambda));
  const lmp = lm * Math.sqrt(ry / E);
  return { lm, lmp };
}

/** Коэффициент продольного изгиба φ */
export function getPhi(type: SectionType, lmp: number): number | null {
  if (lmp < 0.4) return 1.0;

  const tableMap: Record<SectionType, PhiRow[]> = { a: PHI_A, b: PHI_B, c: PHI_C };
  const table = tableMap[type];
  if (!table) return null;

  const maxInTable = table[table.length - 1][0];

  if (lmp <= maxInTable) return interpolate(table, lmp);

  if (lmp > 10.0) return 7.6 / (lmp * lmp);

  if (lmp < PHI_HIGH[0][0]) {
    const [x2, y2] = PHI_HIGH[0];
    const [x1, y1] = [maxInTable, table[table.length - 1][1]];
    return y1 + (y2 - y1) * (lmp - x1) / (x2 - x1);
  }

  return interpolate(PHI_HIGH, lmp);
}

/** Форматирование числа – целые и дроби, либо научная нотация */
export function formatNumber(num: number): string {
  const abs = Math.abs(num);
  if (abs === 0) return "0";
  if (abs >= 10_000 || (abs < 0.001)) {
    const exp = Math.floor(Math.log10(abs));
    const coeff = (num / Math.pow(10, exp)).toFixed(4);
    return `${coeff} × 10<sup>${exp}</sup>`;
  }
  return num.toFixed(6);
}

/** Основной расчёт устойчивости.
 *  При ошибке возвращает { error: '<i18n-key>' }, иначе CalcResult.
 */
export function calculateStability(
  grade: string,
  thickness: number,
  lambda: number,
  yc: number,
  areaSI: number,   // м²
  forceSI: number,  // Н
  sectionType: SectionType,
): CalcResult | CalcError {
  if (!isFinite(thickness) || thickness <= 0)
    return { error: 'err-thickness' };

  if (!isFinite(lambda) || lambda < 10 || lambda > 120)
    return { error: 'err-lambda' };

  if (!isFinite(areaSI) || areaSI <= 0 || !isFinite(forceSI) || forceSI <= 0)
    return { error: 'err-area' };

  const ry = getRy(grade, thickness);
  if (ry === null)
    return { error: 'err-grade' };

  const lmpResult = calculateLmp(lambda, ry);
  if (!lmpResult) return { error: 'err-lmp' };

  const phi = getPhi(sectionType, lmpResult.lmp);
  if (phi === null) return { error: 'err-phi' };

  const ryPa = ry * 1e6;
  const denominator = phi * areaSI * ryPa * yc;
  const ratio = forceSI / denominator;

  return {
    phi,
    ry,
    ryPa,
    lmp: lmpResult.lmp,
    area: areaSI,
    force: forceSI,
    denominator,
    ratio,
    isStable: ratio <= 1,
    yc,
  };
}
