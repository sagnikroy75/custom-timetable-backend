export type EventCategory =
  | 'lecture'
  | 'tutorial'
  | 'lab'
  | 'study'
  | 'exam'
  | 'meeting'
  | 'personal'
  | 'other';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type DayOfWeek = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // e.g., 1 = every week, 2 = every 2 weeks (bi-weekly)
  byDay?: DayOfWeek[]; // ['MO', 'WE', 'FR']
  until?: string; // ISO 8601 string, e.g. "2026-12-15T23:59:59Z"
  count?: number; // Max occurrences
  exdates?: string[]; // ISO date strings to skip (exceptions/holidays)
}

export interface CustomEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  location?: string;
  category: EventCategory;
  color: string;
  startTime: string; // ISO 8601 string
  endTime: string; // ISO 8601 string
  allDay?: boolean;
  recurrence?: RecurrenceRule;
  reminders?: number[]; // Minutes before start, e.g. [15, 60]
  createdAt: string;
  updatedAt: string;

  // Metadata when expanded dynamically from recurring series
  isOccurrence?: boolean;
  masterEventId?: string;
  occurrenceIndex?: number;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  category?: EventCategory;
  color?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  recurrence?: RecurrenceRule;
  reminders?: number[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  location?: string;
  category?: EventCategory;
  color?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  recurrence?: RecurrenceRule;
  reminders?: number[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  studentId?: string;
  department?: string;
  passwordHash: string;
  createdAt: string;
}

export interface ClashResult {
  hasClash: boolean;
  clashingEvents: {
    event: CustomEvent;
    overlapMinutes: number;
    overlapStart: string;
    overlapEnd: string;
  }[];
}

export interface FreeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}
