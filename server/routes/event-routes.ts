import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { requireAuth } from '../auth';
import { mongoService, type MongoEventDoc } from '../mongo';
import { storage } from '../storage';
import { generateICS } from '../ics';
import type { CustomEvent } from '../types';

export function registerEventRoutes(app: FastifyInstance) {
  const listEventsHandler = async (req: FastifyRequest) => {
    const userId = req.user!.id;
    const query = (req.query || {}) as {
      start?: string;
      end?: string;
      category?: string;
      search?: string;
      expandRecurring?: string;
    };

    // MongoDB query explicitly scoped to the authenticated user
    const mongoFilter: Record<string, any> = { userId };
    if (query.category) {
      mongoFilter.category = query.category;
    }

    // Retrieve events from MongoDB
    const dbEvents = await mongoService.eventsCollection.find(mongoFilter).toArray();
    let events: CustomEvent[] = dbEvents as unknown as CustomEvent[];

    // Keyword search filter (case-insensitive across title, description, and location)
    if (query.search && query.search.trim()) {
      const s = query.search.toLowerCase().trim();
      events = events.filter(
        (e) =>
          (e.title && e.title.toLowerCase().includes(s)) ||
          (e.description && e.description.toLowerCase().includes(s)) ||
          (e.location && e.location.toLowerCase().includes(s))
      );
    }

    // Recurrence expansion
    const shouldExpand = query.expandRecurring !== 'false';
    const queryStart = query.start ? new Date(query.start).getTime() : null;
    const queryEnd = query.end ? new Date(query.end).getTime() : null;

    if (shouldExpand && queryStart !== null && queryEnd !== null) {
      const expandedList: CustomEvent[] = [];
      for (const evt of events) {
        if (!evt.recurrence) {
          const eStart = new Date(evt.startTime).getTime();
          const eEnd = new Date(evt.endTime).getTime();
          if (eEnd >= queryStart && eStart <= queryEnd) {
            expandedList.push(evt);
          }
        } else {
          const occurrences = storage.expandRecurringEvent(evt, queryStart, queryEnd);
          expandedList.push(...occurrences);
        }
      }
      events = expandedList;
    } else if (!shouldExpand) {
      if (queryStart !== null) {
        events = events.filter((e) => new Date(e.endTime).getTime() >= queryStart);
      }
      if (queryEnd !== null) {
        events = events.filter((e) => new Date(e.startTime).getTime() <= queryEnd);
      }
    }

    // Sort by startTime ascending
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return { success: true, count: events.length, events };
  };
  app.get('/events', { preHandler: requireAuth }, listEventsHandler);
  app.get('/api/events', { preHandler: requireAuth }, listEventsHandler);

  const getEventHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.id;
    const params = req.params as { id: string };

    // MongoDB query strictly scoped to { id, userId }
    const event = await mongoService.eventsCollection.findOne({ id: params.id, userId });
    if (!event) {
      return reply.status(404).send({ success: false, error: 'Event not found or belongs to another user' });
    }
    return { success: true, event };
  };
  app.get('/events/:id', { preHandler: requireAuth }, getEventHandler);
  app.get('/api/events/:id', { preHandler: requireAuth }, getEventHandler);

  const createEventHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.id;
    const body = (req.body || {}) as Partial<CustomEvent>;
    const { title, startTime, endTime } = body;

    if (!title || !title.trim()) {
      return reply.status(400).send({ success: false, error: 'title is required' });
    }
    if (!startTime || !endTime) {
      return reply.status(400).send({ success: false, error: 'startTime and endTime are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return reply.status(400).send({ success: false, error: 'Valid ISO-8601 startTime and endTime are required' });
    }
    if (start >= end) {
      return reply.status(400).send({ success: false, error: 'endTime must be strictly after startTime' });
    }

    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    const newEvent: MongoEventDoc = {
      id: eventId,
      userId, // Guaranteed scoped to authenticated user
      title: title.trim(),
      description: body.description?.trim() || '',
      location: body.location?.trim() || '',
      category: body.category || 'other',
      color: body.color || '#2563eb',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      allDay: Boolean(body.allDay),
      recurrence: body.recurrence,
      reminders: Array.isArray(body.reminders) ? body.reminders : [15],
      createdAt: now,
      updatedAt: now,
    };

    // Insert into MongoDB collection
    await mongoService.eventsCollection.insertOne(newEvent);
    storage.syncEventFromMongo(newEvent as unknown as CustomEvent);

    const clashResult = storage.detectClashes(userId, { startTime: newEvent.startTime, endTime: newEvent.endTime });

    return reply.status(201).send({
      success: true,
      event: newEvent,
      hasClashes: clashResult.hasClash,
      clashes: clashResult.clashingEvents,
      warning: clashResult.hasClash
        ? `Schedule warning: Overlaps with ${clashResult.clashingEvents.length} existing event(s)`
        : undefined,
    });
  };
  app.post('/events', { preHandler: requireAuth }, createEventHandler);
  app.post('/api/events', { preHandler: requireAuth }, createEventHandler);

  const updateEventHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.id;
    const params = req.params as { id: string };
    const body = (req.body || {}) as Partial<CustomEvent>;

    // Verify document exists in MongoDB with scoped query { id, userId }
    const existing = await mongoService.eventsCollection.findOne({ id: params.id, userId });
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Event not found or access denied' });
    }

    // Validate times if provided
    const newStartStr = body.startTime !== undefined ? body.startTime : existing.startTime;
    const newEndStr = body.endTime !== undefined ? body.endTime : existing.endTime;
    const newStart = new Date(newStartStr);
    const newEnd = new Date(newEndStr);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      return reply.status(400).send({ success: false, error: 'Valid ISO-8601 startTime and endTime are required' });
    }
    if (newStart >= newEnd) {
      return reply.status(400).send({ success: false, error: 'endTime must be strictly after startTime' });
    }

    const updatedAt = new Date().toISOString();
    const updateFields: Partial<MongoEventDoc> = {
      updatedAt,
    };

    if (body.title !== undefined) updateFields.title = body.title.trim();
    if (body.description !== undefined) updateFields.description = body.description.trim();
    if (body.location !== undefined) updateFields.location = body.location.trim();
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.color !== undefined) updateFields.color = body.color;
    if (body.startTime !== undefined) updateFields.startTime = newStart.toISOString();
    if (body.endTime !== undefined) updateFields.endTime = newEnd.toISOString();
    if (body.allDay !== undefined) updateFields.allDay = Boolean(body.allDay);
    if (body.recurrence !== undefined) updateFields.recurrence = body.recurrence;
    if (body.reminders !== undefined) updateFields.reminders = body.reminders;

    // Update in MongoDB scoped strictly to { id, userId }
    const updateRes = await mongoService.eventsCollection.updateOne(
      { id: params.id, userId },
      { $set: updateFields }
    );

    if (updateRes.matchedCount === 0) {
      return reply.status(404).send({ success: false, error: 'Event not found or access denied' });
    }

    const updatedEvent = await mongoService.eventsCollection.findOne({ id: params.id, userId });
    if (updatedEvent) {
      storage.syncEventFromMongo(updatedEvent as unknown as CustomEvent);
    }

    return { success: true, event: updatedEvent };
  };
  app.put('/events/:id', { preHandler: requireAuth }, updateEventHandler);
  app.put('/api/events/:id', { preHandler: requireAuth }, updateEventHandler);
  app.patch('/events/:id', { preHandler: requireAuth }, updateEventHandler);
  app.patch('/api/events/:id', { preHandler: requireAuth }, updateEventHandler);

  const deleteEventHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.id;
    const params = req.params as { id: string };

    // Delete in MongoDB scoped strictly to { id, userId }
    const deleteRes = await mongoService.eventsCollection.deleteOne({ id: params.id, userId });
    if (deleteRes.deletedCount === 0) {
      return reply.status(404).send({ success: false, error: 'Event not found or access denied' });
    }

    storage.deleteEvent(userId, params.id);
    return { success: true, message: 'Event deleted successfully' };
  };
  app.delete('/events/:id', { preHandler: requireAuth }, deleteEventHandler);
  app.delete('/api/events/:id', { preHandler: requireAuth }, deleteEventHandler);

  // Detect Clashes
  const detectClashesHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.id;
    const body = (req.body || {}) as { startTime: string; endTime: string; excludeEventId?: string };
    const { startTime, endTime, excludeEventId } = body;
    if (!startTime || !endTime) {
      return reply.status(400).send({ success: false, error: 'startTime and endTime are required' });
    }
    const clashResult = storage.detectClashes(userId, { startTime, endTime, excludeEventId });
    return {
      success: true,
      hasClashes: clashResult.hasClash,
      clashCount: clashResult.clashingEvents.length,
      clashes: clashResult.clashingEvents,
    };
  };
  app.post('/events/detect-clashes', { preHandler: requireAuth }, detectClashesHandler);
  app.post('/api/events/detect-clashes', { preHandler: requireAuth }, detectClashesHandler);

  // Free Slots
  const freeSlotsHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.id;
    const query = (req.query || {}) as {
      date: string;
      minDurationMinutes?: string;
      dayStartHour?: string;
      dayEndHour?: string;
    };
    const { date, minDurationMinutes, dayStartHour, dayEndHour } = query;
    if (!date) {
      return reply.status(400).send({ success: false, error: 'date query parameter is required (e.g. 2026-09-22)' });
    }
    const freeSlots = storage.findFreeSlots(userId, date, {
      minDurationMinutes: minDurationMinutes ? parseInt(minDurationMinutes, 10) : 30,
      dayStartHour: dayStartHour ? parseInt(dayStartHour, 10) : 9,
      dayEndHour: dayEndHour ? parseInt(dayEndHour, 10) : 19,
    });
    return {
      success: true,
      date,
      freeSlotCount: freeSlots.length,
      freeSlots,
    };
  };
  app.get('/events/free-slots', { preHandler: requireAuth }, freeSlotsHandler);
  app.get('/api/events/free-slots', { preHandler: requireAuth }, freeSlotsHandler);

  // iCalendar RFC 5545 Export
  const exportIcsHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.id;
    const user = await mongoService.usersCollection.findOne({ id: userId });
    const masterEvents = storage.listEvents(userId, { expandRecurring: false });
    const calName = user ? `${user.name}'s Custom Timetable` : 'Custom Timetable';
    const icsData = generateICS(masterEvents, calName);

    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="timetable-${userId}.ics"`)
      .send(icsData);
  };
  app.get('/events/export.ics', { preHandler: requireAuth }, exportIcsHandler);
  app.get('/api/events/export.ics', { preHandler: requireAuth }, exportIcsHandler);
}
