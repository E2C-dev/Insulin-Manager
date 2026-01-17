// 投与タイミング（青背景）
export type InsulinTimeSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Bedtime';

// 測定タイミング（白背景）
export type MeasurementTimeSlot = 
  | 'BreakfastBefore'  // 朝食前
  | 'BreakfastAfter1h' // 朝食後1h
  | 'LunchBefore'      // 昼食前
  | 'LunchAfter1h'     // 昼食後1h
  | 'DinnerBefore'     // 夕食前
  | 'DinnerAfter1h'    // 夕食後1h
  | 'BeforeSleep'      // 睡眠時（眠前後）
  | 'Night';           // 夜間

// インスリン投与記録
export interface InsulinEntry {
  id: string;
  date: Date;
  timeSlot: InsulinTimeSlot;
  units: number; // 投与量（単位）
  note?: string;
}

// 血糖値測定記録
export interface GlucoseEntry {
  id: string;
  date: Date;
  timeSlot: MeasurementTimeSlot;
  glucoseLevel: number; // mg/dL
  note?: string;
}

// 1日の記録（まとめて表示用）
export interface DailyRecord {
  date: Date;
  // 投与量
  breakfastInsulin?: number;
  lunchInsulin?: number;
  dinnerInsulin?: number;
  bedtimeInsulin?: number;
  // 血糖値測定
  breakfastBefore?: number;
  breakfastAfter1h?: number;
  lunchAfter1h?: number;
  dinnerAfter1h?: number;
  beforeSleep?: number;
  night?: number;
}

export interface UserSettings {
  targetGlucoseLow: number;
  targetGlucoseHigh: number;
  insulinSensitivityFactor: number; // ISF: How much 1 unit drops glucose
  carbRatio: number; // I:C Ratio: Grams of carbs per 1 unit
  // 基礎投与量（青背景の列）
  basalInsulinDoses: {
    Breakfast: number;  // 朝
    Lunch: number;      // 昼
    Dinner: number;     // 夕
    Bedtime: number;    // 眠前
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  targetGlucoseLow: 80,
  targetGlucoseHigh: 130,
  insulinSensitivityFactor: 40,
  carbRatio: 10,
  basalInsulinDoses: {
    Breakfast: 43,  // 朝の投与量
    Lunch: 36,      // 昼の投与量
    Dinner: 37,     // 夕の投与量
    Bedtime: 13,    // 眠前の投与量
  },
};

// 投与タイミング
export const INSULIN_TIME_SLOTS: InsulinTimeSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Bedtime'];

export const INSULIN_TIME_SLOT_LABELS: Record<InsulinTimeSlot, string> = {
  Breakfast: '朝',
  Lunch: '昼',
  Dinner: '夕',
  Bedtime: '眠前',
};

// 測定タイミング
export const MEASUREMENT_TIME_SLOTS: MeasurementTimeSlot[] = [
  'BreakfastBefore',
  'BreakfastAfter1h',
  'LunchBefore',
  'LunchAfter1h',
  'DinnerBefore',
  'DinnerAfter1h',
  'BeforeSleep',
  'Night'
];

export const MEASUREMENT_TIME_SLOT_LABELS: Record<MeasurementTimeSlot, string> = {
  BreakfastBefore: '食前',      // 朝食前
  BreakfastAfter1h: '食後1h',   // 朝食後1h
  LunchBefore: '食前',          // 昼食前
  LunchAfter1h: '食後1h',       // 昼食後1h
  DinnerBefore: '食前',         // 夕食前
  DinnerAfter1h: '食後1h',      // 夕食後1h
  BeforeSleep: '睡眠時',        // 睡眠時
  Night: '夜間',                // 夜間
};

// スプレッドシートの列構造
export const SPREADSHEET_COLUMNS = {
  Breakfast: {
    insulin: '朝',
    measurements: ['食前', '食後1h']
  },
  Lunch: {
    insulin: '昼',
    measurements: ['食後1h']
  },
  Dinner: {
    insulin: '夕',
    measurements: ['食後1h']
  },
  Bedtime: {
    insulin: '眠前',
    measurements: ['睡眠時', '夜間']
  }
} as const;

// 投与タイミングの色
export const getInsulinTimeSlotColor = (slot: InsulinTimeSlot) => {
  switch (slot) {
    case 'Breakfast':
      return 'bg-orange-500 text-white';
    case 'Lunch':
      return 'bg-yellow-500 text-white';
    case 'Dinner':
      return 'bg-purple-500 text-white';
    case 'Bedtime':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

// 測定タイミングの色（血糖値の状態による）
export const getMeasurementTimeSlotColor = (slot: MeasurementTimeSlot) => {
  // 朝食関連
  if (slot === 'BreakfastBefore' || slot === 'BreakfastAfter1h') {
    return 'bg-orange-50 border-orange-200';
  }
  // 昼食関連
  if (slot === 'LunchAfter1h') {
    return 'bg-yellow-50 border-yellow-200';
  }
  // 夕食関連
  if (slot === 'DinnerAfter1h') {
    return 'bg-purple-50 border-purple-200';
  }
  // 眠前・夜間
  if (slot === 'BeforeSleep' || slot === 'Night') {
    return 'bg-blue-50 border-blue-200';
  }
  return 'bg-gray-50 border-gray-200';
};

export const getGlucoseStatusColor = (value: number, settings: UserSettings) => {
  if (value < 70) return 'text-status-low font-bold';
  if (value > 180) return 'text-status-high font-bold';
  if (value >= settings.targetGlucoseLow && value <= settings.targetGlucoseHigh) return 'text-status-ok';
  return 'text-foreground';
};
