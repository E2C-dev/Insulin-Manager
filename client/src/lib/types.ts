export type TimeSlot = 'Morning' | 'Noon' | 'Evening' | 'Night';

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
    Morning: number;
    Noon: number;
    Evening: number;
    Night: number;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  targetGlucoseLow: 80,
  targetGlucoseHigh: 130,
  insulinSensitivityFactor: 40,
  carbRatio: 10,
  basalRates: {
    Morning: 4,
    Noon: 5,
    Evening: 6,
    Night: 8,
  },
};

export const TIME_SLOTS: TimeSlot[] = ['Morning', 'Noon', 'Evening', 'Night'];

export const getTimeSlotColor = (slot: TimeSlot) => {
  switch (slot) {
    case 'Morning': return 'bg-time-morning text-white';
    case 'Noon': return 'bg-time-noon text-white';
    case 'Evening': return 'bg-time-evening text-white';
    case 'Night': return 'bg-time-night text-white';
    default: return 'bg-gray-500 text-white';
  }
};

export const getTimeSlotBorderColor = (slot: TimeSlot) => {
  switch (slot) {
    case 'Morning': return 'border-time-morning';
    case 'Noon': return 'border-time-noon';
    case 'Evening': return 'border-time-evening';
    case 'Night': return 'border-time-night';
    default: return 'border-gray-500';
  }
};

export const getGlucoseStatusColor = (value: number, settings: UserSettings) => {
  if (value < 70) return 'text-status-low font-bold';
  if (value > 180) return 'text-status-high font-bold';
  if (value >= settings.targetGlucoseLow && value <= settings.targetGlucoseHigh) return 'text-status-ok';
  return 'text-foreground';
};
