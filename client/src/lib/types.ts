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

// ===== インスリンプリセット =====

export type InsulinCategory =
  | '超速効型'
  | '速効型'
  | '中間型'
  | '持効型'
  | '超持効型'
  | '混合型';

export const INSULIN_CATEGORIES: InsulinCategory[] = [
  '超速効型', '速効型', '中間型', '持効型', '超持効型', '混合型'
];

export interface InsulinBrandOption {
  brand: string;
  genericName: string;
  shortName: string;    // 表示用短縮名
  icon: string;         // 絵文字アイコン
  onset: string;        // 効き始め
  duration: string;     // 持続時間
  timing: string;       // 推奨使用タイミング
  description: string;  // 素人向け説明
}

export const INSULIN_CATALOG: Record<InsulinCategory, InsulinBrandOption[]> = {
  '超速効型': [
    {
      brand: 'Humalog (リスプロ)',
      genericName: 'インスリン リスプロ',
      shortName: 'ヒューマログ',
      icon: '⚡',
      onset: '15分以内',
      duration: '3〜5時間',
      timing: '食事直前（15分以内）に注射',
      description: '食事の直前に注射し、食後の血糖上昇を素早く抑える超速効型インスリンです。',
    },
    {
      brand: 'NovoLog/NovoRapid (アスパルト)',
      genericName: 'インスリン アスパルト',
      shortName: 'ノボラピッド',
      icon: '⚡',
      onset: '10〜20分',
      duration: '3〜5時間',
      timing: '食事直前（15分以内）に注射',
      description: '食事の直前に注射し、食後の血糖上昇を素早く抑える超速効型インスリンです。',
    },
    {
      brand: 'Apidra (グルリジン)',
      genericName: 'インスリン グルリジン',
      shortName: 'アピドラ',
      icon: '⚡',
      onset: '10〜15分',
      duration: '3〜4時間',
      timing: '食事直前（15分以内）に注射',
      description: '食事の直前に注射し、食後の血糖上昇を素早く抑える超速効型インスリンです。',
    },
  ],
  '速効型': [
    {
      brand: 'Humulin R (レギュラー)',
      genericName: 'ヒトインスリン',
      shortName: 'ヒューマリンR',
      icon: '💉',
      onset: '30〜60分',
      duration: '6〜8時間',
      timing: '食事30分前に注射',
      description: '食事の30分前に注射する速効型インスリンです。超速効型より古いタイプで、効き始めがやや遅いです。',
    },
    {
      brand: 'Novolin R (レギュラー)',
      genericName: 'ヒトインスリン',
      shortName: 'ノボリンR',
      icon: '💉',
      onset: '30〜60分',
      duration: '6〜8時間',
      timing: '食事30分前に注射',
      description: '食事の30分前に注射する速効型インスリンです。超速効型より古いタイプで、効き始めがやや遅いです。',
    },
  ],
  '中間型': [
    {
      brand: 'Humulin N (NPH)',
      genericName: 'イソファンインスリン',
      shortName: 'ヒューマリンN',
      icon: '🌅',
      onset: '1〜2時間',
      duration: '10〜16時間',
      timing: '朝・夕など決まった時間に注射',
      description: '効果の出始めがゆっくりで、中程度の時間（約半日）持続する中間型インスリンです。',
    },
    {
      brand: 'Novolin N (NPH)',
      genericName: 'イソファンインスリン',
      shortName: 'ノボリンN',
      icon: '🌅',
      onset: '1〜2時間',
      duration: '10〜16時間',
      timing: '朝・夕など決まった時間に注射',
      description: '効果の出始めがゆっくりで、中程度の時間（約半日）持続する中間型インスリンです。',
    },
  ],
  '持効型': [
    {
      brand: 'Lantus (グラルギン U-100)',
      genericName: 'インスリン グラルギン',
      shortName: 'ランタス',
      icon: '🌙',
      onset: '2〜4時間',
      duration: '約24時間',
      timing: '毎日同じ時間に1回注射',
      description: '1日1回注射するだけで、24時間にわたり血糖値を一定に保つ持効型インスリンです。',
    },
    {
      brand: 'Basaglar (グラルギン)',
      genericName: 'インスリン グラルギン',
      shortName: 'バサグラー',
      icon: '🌙',
      onset: '2〜4時間',
      duration: '約24時間',
      timing: '毎日同じ時間に1回注射',
      description: 'ランタスと同成分（グラルギン）のバイオシミラー製品です。1日1回注射で24時間効果が続きます。',
    },
    {
      brand: 'Levemir (デテミル)',
      genericName: 'インスリン デテミル',
      shortName: 'レベミル',
      icon: '🌙',
      onset: '3〜4時間',
      duration: '16〜24時間',
      timing: '1日1〜2回注射',
      description: '持効型インスリンの一種。打つ量によって持続時間が変わる特徴があり、1日1〜2回注射します。',
    },
  ],
  '超持効型': [
    {
      brand: 'Toujeo (グラルギン U-300)',
      genericName: 'インスリン グラルギン',
      shortName: 'トウジェオ',
      icon: '🌙',
      onset: '6時間以降',
      duration: '36時間以上',
      timing: '毎日同じ時間に1回注射',
      description: '高濃度グラルギンの超持効型インスリン。血糖変動を最小限に抑え、低血糖リスクも低いです。',
    },
    {
      brand: 'Tresiba (デグルデク)',
      genericName: 'インスリン デグルデク',
      shortName: 'トレシーバ',
      icon: '🌙',
      onset: '6時間以降',
      duration: '42時間以上',
      timing: '毎日同じ時間に1回注射',
      description: '最も長く効く超持効型インスリン。注射時間が多少ずれても安定した効果が得られます。',
    },
  ],
  '混合型': [
    {
      brand: 'Humalog Mix 25/75',
      genericName: 'リスプロ混合',
      shortName: 'ヒューマログミックス',
      icon: '🔀',
      onset: '15分以内',
      duration: '10〜16時間',
      timing: '食事直前に注射',
      description: '超速効型と中間型を混合した製剤。1本で食後の血糖上昇と基礎インスリンの両方をカバーします。',
    },
    {
      brand: 'NovoLog Mix 70/30',
      genericName: 'アスパルト混合',
      shortName: 'ノボログミックス',
      icon: '🔀',
      onset: '10〜20分',
      duration: '10〜16時間',
      timing: '食事直前に注射',
      description: '超速効型と中間型を混合した製剤。1本で食後の血糖上昇と基礎インスリンの両方をカバーします。',
    },
    {
      brand: 'Humulin 70/30',
      genericName: 'ヒトインスリン混合',
      shortName: 'ヒューマリン70/30',
      icon: '🔀',
      onset: '30〜60分',
      duration: '10〜16時間',
      timing: '食事30分前に注射',
      description: '速効型と中間型を混合した製剤。食事前に注射し、食後血糖と基礎インスリンをカバーします。',
    },
  ],
};

// インスリンプリセット（DBレスポンス型）
export interface InsulinPreset {
  id: string;
  userId: string;
  name: string;
  category: InsulinCategory;
  brand: string;
  defaultBreakfastUnits: string | null;
  defaultLunchUnits: string | null;
  defaultDinnerUnits: string | null;
  defaultBedtimeUnits: string | null;
  sortOrder: number;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

// プリセットから特定スロットのデフォルト投与量を取得するユーティリティ
export function getPresetDefaultUnits(preset: InsulinPreset, slot: InsulinTimeSlot): number | null {
  const map: Record<InsulinTimeSlot, string | null> = {
    Breakfast: preset.defaultBreakfastUnits,
    Lunch: preset.defaultLunchUnits,
    Dinner: preset.defaultDinnerUnits,
    Bedtime: preset.defaultBedtimeUnits,
  };
  const val = map[slot];
  if (val === null || val === undefined) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

// ===== APIレスポンスの共通型 =====

// DBから返ってくる血糖値記録の型
export interface ApiGlucoseEntry {
  id: string;
  userId: string;
  date: string;
  timeSlot: string;
  glucoseLevel: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// DBから返ってくるインスリン記録の型
export interface ApiInsulinEntry {
  id: string;
  userId: string;
  date: string;
  timeSlot: string;
  units: string; // Drizzle decimalはstringで返る
  note?: string;
  presetId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 調整ルール（フロントエンド用）
export interface AdjustmentRule {
  id: string;
  name: string;
  timeSlot: string;
  conditionType: string;
  threshold: number;
  comparison: string;
  adjustmentAmount: number;
  targetTimeSlot: string;
}

// 1日分の集計表示用（LogbookとSettings/PDF共通）
export interface DailyEntry {
  date: string;
  morning: {
    glucoseBefore?: number;
    glucoseAfter?: number;
    insulin?: number;
    insulinId?: string;
  };
  lunch: {
    glucoseBefore?: number;
    glucoseAfter?: number;
    insulin?: number;
    insulinId?: string;
  };
  dinner: {
    glucoseBefore?: number;
    glucoseAfter?: number;
    insulin?: number;
    insulinId?: string;
  };
  bedtime: {
    glucose?: number;
    insulin?: number;
    insulinId?: string;
  };
  glucoseIds?: string[];
  insulinIds?: string[];
}

// ===== 旧型定義（後方互換性のため保持） =====

// インスリン投与記録
export interface InsulinEntry {
  id: string;
  date: Date;
  timeSlot: InsulinTimeSlot;
  units: number;
  note?: string;
}

// 血糖値測定記録
export interface GlucoseEntry {
  id: string;
  date: Date;
  timeSlot: MeasurementTimeSlot;
  glucoseLevel: number;
  note?: string;
}

// 1日の記録（まとめて表示用）
export interface DailyRecord {
  date: Date;
  breakfastInsulin?: number;
  lunchInsulin?: number;
  dinnerInsulin?: number;
  bedtimeInsulin?: number;
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
  insulinSensitivityFactor: number;
  carbRatio: number;
  basalInsulinDoses: {
    Breakfast: number;
    Lunch: number;
    Dinner: number;
    Bedtime: number;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  targetGlucoseLow: 80,
  targetGlucoseHigh: 130,
  insulinSensitivityFactor: 40,
  carbRatio: 10,
  basalInsulinDoses: {
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Bedtime: 0,
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
  BreakfastBefore: '食前',
  BreakfastAfter1h: '食後1h',
  LunchBefore: '食前',
  LunchAfter1h: '食後1h',
  DinnerBefore: '食前',
  DinnerAfter1h: '食後1h',
  BeforeSleep: '睡眠時',
  Night: '夜間',
};

// タイムスロットオプション（Entry.tsx・AdjustmentRules.tsx共通）
export const TIME_SLOT_OPTIONS = [
  { value: 'BreakfastBefore' as MeasurementTimeSlot, label: '朝食の食前', glucoseSlot: true as const, insulinSlot: 'Breakfast' as InsulinTimeSlot },
  { value: 'BreakfastAfter1h' as MeasurementTimeSlot, label: '朝食の食後1時間', glucoseSlot: true as const, insulinSlot: 'Breakfast' as InsulinTimeSlot },
  { value: 'LunchBefore' as MeasurementTimeSlot, label: '昼食の食前', glucoseSlot: true as const, insulinSlot: 'Lunch' as InsulinTimeSlot },
  { value: 'LunchAfter1h' as MeasurementTimeSlot, label: '昼食の食後1時間', glucoseSlot: true as const, insulinSlot: 'Lunch' as InsulinTimeSlot },
  { value: 'DinnerBefore' as MeasurementTimeSlot, label: '夕食の食前', glucoseSlot: true as const, insulinSlot: 'Dinner' as InsulinTimeSlot },
  { value: 'DinnerAfter1h' as MeasurementTimeSlot, label: '夕食の食後1時間', glucoseSlot: true as const, insulinSlot: 'Dinner' as InsulinTimeSlot },
  { value: 'BeforeSleep' as MeasurementTimeSlot, label: '眠前', glucoseSlot: true as const, insulinSlot: 'Bedtime' as InsulinTimeSlot },
] as const;

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
  if (slot === 'BreakfastBefore' || slot === 'BreakfastAfter1h') {
    return 'bg-orange-50 border-orange-200';
  }
  if (slot === 'LunchAfter1h') {
    return 'bg-yellow-50 border-yellow-200';
  }
  if (slot === 'DinnerAfter1h') {
    return 'bg-purple-50 border-purple-200';
  }
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

// シンプルな血糖値色分け（固定閾値: <70 低血糖, >180 高血糖）
export const getGlucoseBasicColor = (value?: number): string => {
  if (!value) return 'text-muted-foreground';
  if (value < 70) return 'text-red-600 font-semibold';
  if (value > 180) return 'text-orange-600 font-semibold';
  return 'text-green-600';
};
