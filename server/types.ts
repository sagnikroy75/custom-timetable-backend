// This file defines the shared "shapes" of data used across the whole server,
// written as TypeScript types and interfaces. They describe what an event,
// a user, a clash result, etc. look like, so every file speaks the same language.

// The kinds of events a student can have in their timetable.
export type EventCategory =
  | 'lecture'
  | 'tutorial'
  | 'lab'
  | 'study'
  | 'exam'
  | 'meeting'
  | 'personal'
  | 'other';

// How often a repeating event occurs.
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
// Days of the week, written in the short calendar style.
export type DayOfWeek = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

// Describes how an event repeats.
// - frequency: DAILY, WEEKLY, MONTHLY or YEARLY.
// - interval: every 1 = every period, 2 = every second period, and so on.
// - byDay: which weekdays it falls on (e.g. ['MO', 'WE'] = Monday and Wednesday).
// - until: the date-time the repetition stops.
// - count: alternative to until - the maximum number of occurrences.
// - exdates: specific dates to skip (holidays or exceptions).
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // e.g., 1 = every week, 2 = every 2 weeks (bi-weekly)
  byDay?: DayOfWeek[]; // ['MO', 'WE', 'FR']
  until?: string; // ISO 8601 string, e.g. "2026-12-15T23:59:59Z"
  count?: number; // Max occurrences
  exdates?: string[]; // ISO date strings to skip (exceptions/holidays)
}

// A single timetable event. This is the main data shape of the whole app.
// - id: a unique event id.
// - userId: which student the event belongs to (used for security).
// - title / description / location: the event's basic details.
// - category: one of the EventCategory values above.
// - color: the calendar colour used by the frontend.
// - startTime / endTime: when the event starts and ends (ISO 8601 strings).
// - allDay: true if the event covers the whole day.
// - recurrence: optional rule describing how the event repeats.
// - reminders: how many minutes before the event to remind the student.
// - createdAt / updatedAt: when the event was created and last changed.
//
// When a repeating event is expanded into individual instances, the generated
// occurrences also carry: isOccurrence (true), masterEventId (the original
// event's id), and occurrenceIndex (its position in the series).
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

// The fields a client must/can send to create a new event.
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

// The fields a client can send to update an event (all optional -
// only the ones provided get changed).
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

// A student account.
// - id: a unique user id, used in events.
// - email / name: basic account details.
// - studentId: the school's identifier for the student (optional).
// - department: the student's department (optional).
// - passwordHash: the scrambled password - never the plain password.
// - createdAt: when the account was made.
export interface User {
  id: string;
  email: string;
  name: string;
  studentId?: string;
  department?: string;
  passwordHash: string;
  createdAt: string;
}

// The result of checking whether a proposed time window conflicts with
// existing events.
// - hasClash: true if any overlap was found.
// - clashingEvents: each conflicting event plus how many minutes overlap
//   with the proposed window and the exact overlap start/end times.
export interface ClashResult {
  hasClash: boolean;
  clashingEvents: {
    event: CustomEvent;
    overlapMinutes: number;
    overlapStart: string;
    overlapEnd: string;
  }[];
}

// A free block of time on a day, used by the "find free slots" feature.
// - start / end: when the free block begins and ends.
// - durationMinutes: how long the block lasts.
export interface FreeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}
