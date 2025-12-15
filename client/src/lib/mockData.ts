import { GlucoseEntry, TimeSlot } from './types';
import { subDays, setHours, setMinutes, addHours } from 'date-fns';

const generateEntries = (): GlucoseEntry[] => {
  const entries: GlucoseEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 14; i++) {
    const date = subDays(now, i);
    
    // Breakfast Before
    entries.push({
      id: `breakfast-before-${i}`,
      timestamp: setMinutes(setHours(date, 7), 0),
      glucoseLevel: Math.floor(Math.random() * (130 - 80) + 80),
      insulinUnits: 4,
      timeSlot: 'BreakfastBefore',
      type: 'Meal',
    });

    // Breakfast After
    if (Math.random() > 0.3) {
      entries.push({
        id: `breakfast-after-${i}`,
        timestamp: setMinutes(setHours(date, 9), 0),
        glucoseLevel: Math.floor(Math.random() * (160 - 100) + 100),
        timeSlot: 'BreakfastAfter',
        type: 'Other',
      });
    }

    // Lunch Before
    entries.push({
      id: `lunch-before-${i}`,
      timestamp: setMinutes(setHours(date, 12), 0),
      glucoseLevel: Math.floor(Math.random() * (150 - 90) + 90),
      insulinUnits: 5,
      timeSlot: 'LunchBefore',
      type: 'Meal',
    });

    // Lunch After
    if (Math.random() > 0.3) {
      entries.push({
        id: `lunch-after-${i}`,
        timestamp: setMinutes(setHours(date, 14), 0),
        glucoseLevel: Math.floor(Math.random() * (170 - 100) + 100),
        timeSlot: 'LunchAfter',
        type: 'Other',
      });
    }

    // Dinner Before
    entries.push({
      id: `dinner-before-${i}`,
      timestamp: setMinutes(setHours(date, 18), 0),
      glucoseLevel: Math.floor(Math.random() * (200 - 100) + 100),
      insulinUnits: 6,
      timeSlot: 'DinnerBefore',
      type: 'Meal',
    });

    // Dinner After
    if (Math.random() > 0.3) {
      entries.push({
        id: `dinner-after-${i}`,
        timestamp: setMinutes(setHours(date, 20), 0),
        glucoseLevel: Math.floor(Math.random() * (180 - 110) + 110),
        timeSlot: 'DinnerAfter',
        type: 'Other',
      });
    }

    // Bedtime
    entries.push({
      id: `bedtime-${i}`,
      timestamp: setMinutes(setHours(date, 22), 0),
      glucoseLevel: Math.floor(Math.random() * (140 - 90) + 90),
      insulinUnits: 12,
      timeSlot: 'Bedtime',
      type: 'Basal',
    });
  }

  // Add a recent high entry for demo
  entries.push({
    id: 'recent-high',
    timestamp: addHours(now, -1),
    glucoseLevel: 240,
    insulinUnits: 2,
    timeSlot: 'LunchAfter',
    type: 'Correction',
    note: 'Forgot pre-meal bolus',
  });

  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const MOCK_ENTRIES = generateEntries();
