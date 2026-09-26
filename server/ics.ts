// This file turns timetable events into a standard calendar file (.ics).
// The .ics format (RFC 5545) is the common format understood by calendar apps
// such as Apple Calendar, Google Calendar, Outlook, and phone calendars.

import type { CustomEvent } from './types';

// Converts an ISO timestamp into the compact format used inside .ics files.
// Example: "2026-09-22T14:30:00.000Z" becomes "20260922T143000Z".
// The function removes dashes, colons, and the milliseconds part.
function formatICSDate(isoString: string): string {
  const date = new Date(isoString);
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

// Makes text safe to include in an .ics file.
// Calendar format reserves the characters backslash, semicolon, comma, and
// newline, so those get a backslash put in front of them. This stops text
// like "Smith, John" from confusing calendar apps.
function escapeICSText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Builds the complete .ics file content from a list of events.
//
// Parameters:
// - events: the events to include in the calendar.
// - calendarName: an optional name for the calendar (defaults to "Custom Timetable").
//
// How it works:
// - It starts the file with the calendar header lines.
// - For each event it writes a VEVENT block with start/end times, title,
//   description, location, category, an optional repeating rule (RRULE),
//   and a reminder alarm if the event has reminders.
// - Only "master" events are exported. Generated occurrences of a repeating
//   series are skipped, because the repeating rule already covers them.
// - It ends the file with the calendar footer and joins all lines with
//   Windows-style line breaks (\r\n) which is the calendar standard.
//
// Returns the whole .ics file as a single string.
export function generateICS(events: CustomEvent[], calendarName = 'Custom Timetable'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Custom Timetable//Events Service//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    `X-WR-TIMEZONE:Asia/Hong_Kong`,
  ];

  const nowStamp = formatICSDate(new Date().toISOString());

  for (const event of events) {
    // Only master events (not generated occurrences) should be exported with RRULE
    if (event.isOccurrence) continue;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@usthing.ust.hk`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${formatICSDate(event.startTime)}`);
    lines.push(`DTEND:${formatICSDate(event.endTime)}`);
    lines.push(`SUMMARY:${escapeICSText(event.title)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeICSText(event.location)}`);
    }
    if (event.category) {
      lines.push(`CATEGORIES:${event.category.toUpperCase()}`);
    }

    // Recurrence rule - this tells calendar apps how often the event repeats
    // (for example every week on Wednesdays) and when it stops.
    if (event.recurrence) {
      const r = event.recurrence;
      const rruleParts: string[] = [`FREQ=${r.frequency}`];
      if (r.interval && r.interval > 1) {
        rruleParts.push(`INTERVAL=${r.interval}`);
      }
      if (r.byDay && r.byDay.length > 0) {
        rruleParts.push(`BYDAY=${r.byDay.join(',')}`);
      }
      if (r.until) {
        rruleParts.push(`UNTIL=${formatICSDate(r.until)}`);
      } else if (r.count) {
        rruleParts.push(`COUNT=${r.count}`);
      }
      lines.push(`RRULE:${rruleParts.join(';')}`);
    }

    // Alarm reminder - the earliest reminder minutes are turned into an
    // alert that fires before the event starts.
    if (event.reminders && event.reminders.length > 0) {
      const earliest = Math.min(...event.reminders);
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${earliest}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeICSText(event.title)} starting in ${earliest} minutes`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
