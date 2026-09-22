import type { CustomEvent } from './types';

/**
 * RFC 5545 iCalendar (ICS) Serializer
 * Formats custom timetable events into standard .ics format
 * compatible with Apple Calendar, Google Calendar, Outlook, and mobile apps.
 */

function formatICSDate(isoString: string): string {
  const date = new Date(isoString);
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapeICSText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

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

    // Recurrence rule
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

    // Alarm reminder
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
