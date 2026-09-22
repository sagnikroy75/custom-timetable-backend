import crypto from 'crypto';
import type {
  CustomEvent,
  CreateEventInput,
  UpdateEventInput,
  ClashResult,
  FreeSlot,
  RecurrenceRule,
  DayOfWeek,
} from './types';

// In-memory data store for the customizable timetable service
class TimetableStorage {
  private events: Map<string, CustomEvent> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Seed realistic HKUST semester events for current week (September 2026)
    const seedEvents: CustomEvent[] = [
      {
        id: 'evt_alice_1',
        userId: 'alice',
        title: 'COMP 3511 Operating Systems Project Meeting',
        description: 'Sprint planning and CPU scheduler milestone review with team.',
        location: 'Library LG4 Discussion Room 12',
        category: 'meeting',
        color: '#2563eb', // Blue
        startTime: '2026-09-22T14:30:00.000Z',
        endTime: '2026-09-22T16:00:00.000Z',
        allDay: false,
        reminders: [15, 60],
        createdAt: '2026-09-15T09:00:00.000Z',
        updatedAt: '2026-09-15T09:00:00.000Z',
      },
      {
        id: 'evt_alice_2',
        userId: 'alice',
        title: 'Timetable Product Sync',
        description: 'Discuss custom timetable API rollout and mobile app integration.',
        location: 'Zoom / HKUST Engineering Commons',
        category: 'meeting',
        color: '#059669', // Emerald
        startTime: '2026-09-23T18:00:00.000Z',
        endTime: '2026-09-23T19:30:00.000Z',
        allDay: false,
        recurrence: {
          frequency: 'WEEKLY',
          interval: 1,
          byDay: ['WE'],
          until: '2026-12-16T23:59:59.000Z',
        },
        reminders: [30],
        createdAt: '2026-09-10T11:00:00.000Z',
        updatedAt: '2026-09-10T11:00:00.000Z',
      },
      {
        id: 'evt_alice_3',
        userId: 'alice',
        title: 'MATH 2111 Multivariable Calculus Self-Study',
        description: 'Finish Problem Set 3 & review Green’s Theorem.',
        location: 'Library G/F Quiet Zone',
        category: 'study',
        color: '#d97706', // Amber
        startTime: '2026-09-24T10:00:00.000Z',
        endTime: '2026-09-24T12:30:00.000Z',
        allDay: false,
        reminders: [10],
        createdAt: '2026-09-18T14:00:00.000Z',
        updatedAt: '2026-09-18T14:00:00.000Z',
      },
      {
        id: 'evt_alice_4',
        userId: 'alice',
        title: 'HKUST Badminton Club Friendly Match',
        description: 'Inter-hall tournament practice round.',
        location: 'S.H. Ho Sports Hall Court 3',
        category: 'personal',
        color: '#7c3aed', // Purple
        startTime: '2026-09-25T19:00:00.000Z',
        endTime: '2026-09-25T21:00:00.000Z',
        allDay: false,
        reminders: [60],
        createdAt: '2026-09-19T08:00:00.000Z',
        updatedAt: '2026-09-19T08:00:00.000Z',
      },

      // Bob's Events (Demonstrates Multi-User Separation)
      {
        id: 'evt_bob_1',
        userId: 'bob',
        title: 'ELEC 3300 Embedded Systems Lab Session',
        description: 'FPGA verilog synthesis & oscilloscope measurement test.',
        location: 'Room 2404 Academic Building',
        category: 'lab',
        color: '#dc2626', // Red
        startTime: '2026-09-22T09:00:00.000Z',
        endTime: '2026-09-22T11:50:00.000Z',
        allDay: false,
        reminders: [15],
        createdAt: '2026-09-12T10:00:00.000Z',
        updatedAt: '2026-09-12T10:00:00.000Z',
      },
      {
        id: 'evt_bob_2',
        userId: 'bob',
        title: 'Robotics Team Mechanical Assembly',
        description: 'Chassis motor test for Robocon 2027.',
        location: 'UG Hall VII MakerSpace',
        category: 'meeting',
        color: '#0891b2', // Cyan
        startTime: '2026-09-24T15:00:00.000Z',
        endTime: '2026-09-24T18:00:00.000Z',
        allDay: false,
        recurrence: {
          frequency: 'WEEKLY',
          interval: 1,
          byDay: ['TH'],
          until: '2026-12-10T23:59:59.000Z',
        },
        reminders: [30],
        createdAt: '2026-09-14T16:00:00.000Z',
        updatedAt: '2026-09-14T16:00:00.000Z',
      },
    ];

    for (const evt of seedEvents) {
      this.events.set(evt.id, evt);
    }
  }

  // --- Event CRUD Operations (Strictly Scoped by userId) ---

  public createEvent(userId: string, input: CreateEventInput): CustomEvent {
    // Basic validation
    if (!input.title || !input.title.trim()) {
      throw new Error('Event title is required');
    }
    if (!input.startTime || isNaN(Date.parse(input.startTime))) {
      throw new Error('Valid ISO-8601 startTime is required');
    }
    if (!input.endTime || isNaN(Date.parse(input.endTime))) {
      throw new Error('Valid ISO-8601 endTime is required');
    }

    const start = new Date(input.startTime).getTime();
    const end = new Date(input.endTime).getTime();
    if (end <= start) {
      throw new Error('endTime must be strictly after startTime');
    }

    const id = `evt_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    const newEvent: CustomEvent = {
      id,
      userId,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      location: input.location?.trim() || '',
      category: input.category || 'other',
      color: input.color || this.getDefaultColor(input.category || 'other'),
      startTime: input.startTime,
      endTime: input.endTime,
      allDay: Boolean(input.allDay),
      recurrence: input.recurrence,
      reminders: input.reminders || [15],
      createdAt: now,
      updatedAt: now,
    };

    this.events.set(id, newEvent);
    return newEvent;
  }

  public syncEventFromMongo(event: CustomEvent): void {
    this.events.set(event.id, event);
  }

  public getEventById(userId: string, eventId: string): CustomEvent | null {
    const event = this.events.get(eventId);
    if (!event) return null;
    // Strict multi-user authorization check
    if (event.userId !== userId) return null;
    return event;
  }

  public updateEvent(userId: string, eventId: string, input: UpdateEventInput): CustomEvent | null {
    const event = this.getEventById(userId, eventId);
    if (!event) return null;

    const startTime = input.startTime ?? event.startTime;
    const endTime = input.endTime ?? event.endTime;

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    if (end <= start) {
      throw new Error('endTime must be strictly after startTime');
    }

    const updated: CustomEvent = {
      ...event,
      title: input.title !== undefined ? input.title.trim() : event.title,
      description: input.description !== undefined ? input.description.trim() : event.description,
      location: input.location !== undefined ? input.location.trim() : event.location,
      category: input.category ?? event.category,
      color: input.color ?? (input.category ? this.getDefaultColor(input.category) : event.color),
      startTime,
      endTime,
      allDay: input.allDay !== undefined ? input.allDay : event.allDay,
      recurrence: input.recurrence !== undefined ? input.recurrence : event.recurrence,
      reminders: input.reminders !== undefined ? input.reminders : event.reminders,
      updatedAt: new Date().toISOString(),
    };

    this.events.set(eventId, updated);
    return updated;
  }

  public deleteEvent(userId: string, eventId: string): boolean {
    const event = this.getEventById(userId, eventId);
    if (!event) return false;
    return this.events.delete(eventId);
  }

  /**
   * List events with query filters and optional recurring event expansion.
   */
  public listEvents(
    userId: string,
    options: {
      start?: string; // Query start range ISO string
      end?: string; // Query end range ISO string
      category?: string;
      search?: string;
      expandRecurring?: boolean;
    } = {}
  ): CustomEvent[] {
    const userEvents = Array.from(this.events.values()).filter((e) => e.userId === userId);

    const queryStart = options.start ? new Date(options.start).getTime() : null;
    const queryEnd = options.end ? new Date(options.end).getTime() : null;
    const shouldExpand = options.expandRecurring !== false;

    const result: CustomEvent[] = [];

    for (const evt of userEvents) {
      // If event has no recurrence
      if (!evt.recurrence) {
        const eStart = new Date(evt.startTime).getTime();
        const eEnd = new Date(evt.endTime).getTime();

        if (queryStart !== null && eEnd < queryStart) continue;
        if (queryEnd !== null && eStart > queryEnd) continue;

        if (options.category && evt.category !== options.category) continue;
        if (options.search) {
          const s = options.search.toLowerCase();
          const match =
            evt.title.toLowerCase().includes(s) ||
            evt.description?.toLowerCase().includes(s) ||
            evt.location?.toLowerCase().includes(s);
          if (!match) continue;
        }

        result.push(evt);
      } else {
        // Event has recurrence rule
        if (shouldExpand && queryStart !== null && queryEnd !== null) {
          const expanded = this.expandRecurringEvent(evt, queryStart, queryEnd);
          for (const occ of expanded) {
            if (options.category && occ.category !== options.category) continue;
            if (options.search) {
              const s = options.search.toLowerCase();
              const match =
                occ.title.toLowerCase().includes(s) ||
                occ.description?.toLowerCase().includes(s) ||
                occ.location?.toLowerCase().includes(s);
              if (!match) continue;
            }
            result.push(occ);
          }
        } else {
          // If not expanding, return the master event
          if (options.category && evt.category !== options.category) continue;
          if (options.search) {
            const s = options.search.toLowerCase();
            const match =
              evt.title.toLowerCase().includes(s) ||
              evt.description?.toLowerCase().includes(s) ||
              evt.location?.toLowerCase().includes(s);
            if (!match) continue;
          }
          result.push(evt);
        }
      }
    }

    // Sort by startTime ascending
    return result.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  /**
   * Recurrence Expansion Algorithm:
   * Expands a master recurring event into discrete occurrences inside [windowStart, windowEnd]
   */
  public expandRecurringEvent(
    master: CustomEvent,
    windowStart: number,
    windowEnd: number
  ): CustomEvent[] {
    const rule = master.recurrence;
    if (!rule) return [master];

    const occurrences: CustomEvent[] = [];
    const baseStart = new Date(master.startTime);
    const baseEnd = new Date(master.endTime);
    const durationMs = baseEnd.getTime() - baseStart.getTime();

    const interval = Math.max(1, rule.interval || 1);
    const maxCount = rule.count || 200; // safety ceiling
    const ruleUntil = rule.until ? new Date(rule.until).getTime() : null;

    const dayMap: Record<DayOfWeek, number> = {
      SU: 0,
      MO: 1,
      TU: 2,
      WE: 3,
      TH: 4,
      FR: 5,
      SA: 6,
    };

    let count = 0;

    if (rule.frequency === 'DAILY') {
      const cursor = new Date(baseStart.getTime());
      while (count < maxCount) {
        const curStartMs = cursor.getTime();
        const curEndMs = curStartMs + durationMs;

        if (ruleUntil !== null && curStartMs > ruleUntil) break;
        if (curStartMs > windowEnd) break;

        if (curEndMs >= windowStart && curStartMs <= windowEnd) {
          occurrences.push({
            ...master,
            id: `${master.id}_occ_${count}`,
            startTime: new Date(curStartMs).toISOString(),
            endTime: new Date(curEndMs).toISOString(),
            isOccurrence: true,
            masterEventId: master.id,
            occurrenceIndex: count,
          });
        }

        count++;
        cursor.setDate(cursor.getDate() + interval);
      }
    } else if (rule.frequency === 'WEEKLY') {
      const allowedDays =
        rule.byDay && rule.byDay.length > 0
          ? rule.byDay.map((d) => dayMap[d])
          : [baseStart.getDay()];

      // Move week by week
      const cursor = new Date(baseStart.getTime());
      // Align cursor to start of week (Sunday)
      cursor.setDate(cursor.getDate() - cursor.getDay());

      while (count < maxCount) {
        let anyOccAdded = false;

        for (const day of [0, 1, 2, 3, 4, 5, 6]) {
          if (allowedDays.includes(day)) {
            const occStart = new Date(cursor.getTime());
            occStart.setDate(cursor.getDate() + day);
            occStart.setHours(
              baseStart.getHours(),
              baseStart.getMinutes(),
              baseStart.getSeconds(),
              baseStart.getMilliseconds()
            );

            const curStartMs = occStart.getTime();
            const curEndMs = curStartMs + durationMs;

            // Occurrence must not be before base event start time
            if (curStartMs < baseStart.getTime()) continue;
            if (ruleUntil !== null && curStartMs > ruleUntil) break;
            if (curStartMs > windowEnd) break;

            if (curEndMs >= windowStart && curStartMs <= windowEnd) {
              occurrences.push({
                ...master,
                id: `${master.id}_occ_${count}`,
                startTime: new Date(curStartMs).toISOString(),
                endTime: new Date(curEndMs).toISOString(),
                isOccurrence: true,
                masterEventId: master.id,
                occurrenceIndex: count,
              });
            }

            count++;
            anyOccAdded = true;
          }
        }

        cursor.setDate(cursor.getDate() + interval * 7);
        if (cursor.getTime() > windowEnd && !anyOccAdded) break;
        if (ruleUntil !== null && cursor.getTime() > ruleUntil) break;
      }
    } else if (rule.frequency === 'MONTHLY') {
      const cursor = new Date(baseStart.getTime());
      while (count < maxCount) {
        const curStartMs = cursor.getTime();
        const curEndMs = curStartMs + durationMs;

        if (ruleUntil !== null && curStartMs > ruleUntil) break;
        if (curStartMs > windowEnd) break;

        if (curEndMs >= windowStart && curStartMs <= windowEnd) {
          occurrences.push({
            ...master,
            id: `${master.id}_occ_${count}`,
            startTime: new Date(curStartMs).toISOString(),
            endTime: new Date(curEndMs).toISOString(),
            isOccurrence: true,
            masterEventId: master.id,
            occurrenceIndex: count,
          });
        }

        count++;
        cursor.setMonth(cursor.getMonth() + interval);
      }
    } else {
      // Default: single occurrence
      occurrences.push(master);
    }

    return occurrences;
  }

  /**
   * Conflict / Clash Detection:
   * Checks if an event overlaps with any existing events of the user.
   */
  public detectClashes(
    userId: string,
    proposed: { startTime: string; endTime: string; excludeEventId?: string }
  ): ClashResult {
    const propStart = new Date(proposed.startTime).getTime();
    const propEnd = new Date(proposed.endTime).getTime();

    // Query window around the proposed event
    const events = this.listEvents(userId, {
      start: proposed.startTime,
      end: proposed.endTime,
      expandRecurring: true,
    });

    const clashingEvents: ClashResult['clashingEvents'] = [];

    for (const evt of events) {
      if (proposed.excludeEventId && (evt.id === proposed.excludeEventId || evt.masterEventId === proposed.excludeEventId)) {
        continue;
      }

      const eStart = new Date(evt.startTime).getTime();
      const eEnd = new Date(evt.endTime).getTime();

      // Overlap formula: max(start1, start2) < min(end1, end2)
      const overlapStart = Math.max(propStart, eStart);
      const overlapEnd = Math.min(propEnd, eEnd);

      if (overlapStart < overlapEnd) {
        const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);
        clashingEvents.push({
          event: evt,
          overlapMinutes,
          overlapStart: new Date(overlapStart).toISOString(),
          overlapEnd: new Date(overlapEnd).toISOString(),
        });
      }
    }

    return {
      hasClash: clashingEvents.length > 0,
      clashingEvents,
    };
  }

  /**
   * Find Free Slots for scheduling a study session, meeting, or assignment:
   */
  public findFreeSlots(
    userId: string,
    targetDate: string, // YYYY-MM-DD
    options: {
      dayStartHour?: number; // default 9 (09:00)
      dayEndHour?: number; // default 21 (21:00)
      minDurationMinutes?: number; // default 30
    } = {}
  ): FreeSlot[] {
    const startHour = options.dayStartHour ?? 9;
    const endHour = options.dayEndHour ?? 21;
    const minDuration = options.minDurationMinutes ?? 30;

    const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
    dayStart.setUTCHours(startHour, 0, 0, 0);

    const dayEnd = new Date(`${targetDate}T00:00:00.000Z`);
    dayEnd.setUTCHours(endHour, 0, 0, 0);

    const events = this.listEvents(userId, {
      start: dayStart.toISOString(),
      end: dayEnd.toISOString(),
      expandRecurring: true,
    });

    // Sort events
    const busyIntervals: { start: number; end: number }[] = events.map((e) => ({
      start: Math.max(dayStart.getTime(), new Date(e.startTime).getTime()),
      end: Math.min(dayEnd.getTime(), new Date(e.endTime).getTime()),
    })).filter((i) => i.start < i.end).sort((a, b) => a.start - b.start);

    // Merge overlapping busy intervals
    const mergedBusy: { start: number; end: number }[] = [];
    for (const b of busyIntervals) {
      if (mergedBusy.length === 0) {
        mergedBusy.push(b);
      } else {
        const last = mergedBusy[mergedBusy.length - 1]!;
        if (b.start <= last.end) {
          last.end = Math.max(last.end, b.end);
        } else {
          mergedBusy.push(b);
        }
      }
    }

    const freeSlots: FreeSlot[] = [];
    let cursor = dayStart.getTime();

    for (const busy of mergedBusy) {
      if (busy.start > cursor) {
        const diffMinutes = Math.round((busy.start - cursor) / 60000);
        if (diffMinutes >= minDuration) {
          freeSlots.push({
            start: new Date(cursor).toISOString(),
            end: new Date(busy.start).toISOString(),
            durationMinutes: diffMinutes,
          });
        }
      }
      cursor = Math.max(cursor, busy.end);
    }

    if (dayEnd.getTime() > cursor) {
      const diffMinutes = Math.round((dayEnd.getTime() - cursor) / 60000);
      if (diffMinutes >= minDuration) {
        freeSlots.push({
          start: new Date(cursor).toISOString(),
          end: dayEnd.toISOString(),
          durationMinutes: diffMinutes,
        });
      }
    }

    return freeSlots;
  }

  private getDefaultColor(category: string): string {
    const colors: Record<string, string> = {
      lecture: '#2563eb', // Blue
      tutorial: '#0284c7', // Light blue
      lab: '#059669', // Green
      study: '#d97706', // Amber
      exam: '#dc2626', // Red
      meeting: '#7c3aed', // Purple
      personal: '#db2777', // Pink
      other: '#475569', // Slate
    };
    return colors[category] || '#2563eb';
  }
}

export const storage = new TimetableStorage();
