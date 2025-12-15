import { GlucoseEntry, TimeSlot } from './types';
import { subDays, setHours, setMinutes, addHours } from 'date-fns';

const generateEntries = (): GlucoseEntry[] => {
  const entries: GlucoseEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 14; i++) {
    const date = subDays(now, i);
    
    // Morning
    entries.push({
      id: `morning-${i}`,
      timestamp: setMinutes(setHours(date, 7), 30),
      glucoseLevel: Math.floor(Math.random() * (140 - 80) + 80),
      insulinUnits: 4,
      timeSlot: 'Morning',
      type: 'Meal',
    });

    // Noon
    entries.push({
      id: `noon-${i}`,
      timestamp: setMinutes(setHours(date, 12), 30),
      glucoseLevel: Math.floor(Math.random() * (160 - 90) + 90),
      insulinUnits: 6,
      timeSlot: 'Noon',
      type: 'Meal',
    });

    // Evening
    entries.push({
      id: `evening-${i}`,
      timestamp: setMinutes(setHours(date, 18), 30),
      glucoseLevel: Math.floor(Math.random() * (200 - 100) + 100), // Sometimes high
      insulinUnits: 8,
      timeSlot: 'Evening',
      type: 'Meal',
    });

    // Night
    entries.push({
      id: `night-${i}`,
      timestamp: setMinutes(setHours(date, 22), 0),
      glucoseLevel: Math.floor(Math.random() * (130 - 90) + 90),
      insulinUnits: 12, // Basal
      timeSlot: 'Night',
      type: 'Basal',
    });
  }

  // Add a recent high entry for demo
  entries.push({
    id: 'recent-high',
    timestamp: addHours(now, -1),
    glucoseLevel: 240,
    insulinUnits: 2,
    timeSlot: 'Noon',
    type: 'Correction',
    note: 'Forgot pre-meal bolus',
  });

  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const MOCK_ENTRIES = generateEntries();
