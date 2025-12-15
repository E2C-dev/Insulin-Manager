export type TimeSlot = 'BreakfastBefore' | 'BreakfastAfter' | 'LunchBefore' | 'LunchAfter' | 'DinnerBefore' | 'DinnerAfter' | 'Bedtime';

export interface GlucoseEntry {
  id: string;
  timestamp: Date;
  glucoseLevel: number; // mg/dL
  insulinUnits?: number;
  timeSlot: TimeSlot;
  note?: string;
  type: 'Meal' | 'Correction' | 'Basal' | 'Other';
}

export interface UserSettings {
  targetGlucoseLow: number;
  targetGlucoseHigh: number;
  insulinSensitivityFactor: number; // ISF: How much 1 unit drops glucose
  carbRatio: number; // I:C Ratio: Grams of carbs per 1 unit
  basalRates: {
    BreakfastBefore: number;
    BreakfastAfter: number;
    LunchBefore: number;
    LunchAfter: number;
    DinnerBefore: number;
    DinnerAfter: number;
    Bedtime: number;
  };
  enabledTimeSlots: TimeSlot[];
}

export const DEFAULT_SETTINGS: UserSettings = {
  targetGlucoseLow: 80,
  targetGlucoseHigh: 130,
  insulinSensitivityFactor: 40,
  carbRatio: 10,
  basalRates: {
    BreakfastBefore: 4,
    BreakfastAfter: 0,
    LunchBefore: 5,
    LunchAfter: 0,
    DinnerBefore: 6,
    DinnerAfter: 0,
    Bedtime: 8,
  },
  enabledTimeSlots: ['BreakfastBefore', 'BreakfastAfter', 'LunchBefore', 'LunchAfter', 'DinnerBefore', 'DinnerAfter', 'Bedtime'],
};

export const TIME_SLOTS: TimeSlot[] = ['BreakfastBefore', 'BreakfastAfter', 'LunchBefore', 'LunchAfter', 'DinnerBefore', 'DinnerAfter', 'Bedtime'];

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  BreakfastBefore: '朝食前',
  BreakfastAfter: '朝食後',
  LunchBefore: '昼食前',
  LunchAfter: '昼食後',
  DinnerBefore: '夕食前',
  DinnerAfter: '夕食後',
  Bedtime: '眠前',
};

export const TIME_SLOT_SHORT_LABELS: Record<TimeSlot, string> = {
  BreakfastBefore: '朝前',
  BreakfastAfter: '朝後',
  LunchBefore: '昼前',
  LunchAfter: '昼後',
  DinnerBefore: '夕前',
  DinnerAfter: '夕後',
  Bedtime: '眠前',
};

export const getTimeSlotColor = (slot: TimeSlot) => {
  switch (slot) {
    case 'BreakfastBefore':
    case 'BreakfastAfter':
      return 'bg-time-morning text-white';
    case 'LunchBefore':
    case 'LunchAfter':
      return 'bg-time-noon text-white';
    case 'DinnerBefore':
    case 'DinnerAfter':
      return 'bg-time-evening text-white';
    case 'Bedtime':
      return 'bg-time-night text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export const getTimeSlotBorderColor = (slot: TimeSlot) => {
  switch (slot) {
    case 'BreakfastBefore':
    case 'BreakfastAfter':
      return 'border-time-morning';
    case 'LunchBefore':
    case 'LunchAfter':
      return 'border-time-noon';
    case 'DinnerBefore':
    case 'DinnerAfter':
      return 'border-time-evening';
    case 'Bedtime':
      return 'border-time-night';
    default:
      return 'border-gray-500';
  }
};

export const getGlucoseStatusColor = (value: number, settings: UserSettings) => {
  if (value < 70) return 'text-status-low font-bold';
  if (value > 180) return 'text-status-high font-bold';
  if (value >= settings.targetGlucoseLow && value <= settings.targetGlucoseHigh) return 'text-status-ok';
  return 'text-foreground';
};
