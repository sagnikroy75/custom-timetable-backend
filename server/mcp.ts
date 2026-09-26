// This file implements a small "toolbox" that AI assistants can call
// through the Model Context Protocol (MCP). It speaks JSON-RPC 2.0, a simple
// message format, so a chat assistant can list events, create events, check
// for schedule clashes, find free time, and export a calendar.
//
// The main function here is handleMCPRequest: you give it a user id and a
// request message, and it performs the requested action and returns a reply.

import { storage } from './storage';
import { generateICS } from './ics';
import type { CreateEventInput } from './types';

/**
 * Model Context Protocol (MCP) JSON-RPC 2.0 implementation
 * Provides JSON-RPC tools for timetable scheduling, conflict checks, and event management.
 */

// The shape of an incoming request message from an AI assistant.
// - jsonrpc: must always be "2.0" (the message format version).
// - id: a number or string the assistant uses to match the reply to the request.
// - method: what to do, e.g. "tools/list" or "tools/call".
// - params: the details of the call (tool name plus its arguments).
export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, any>;
}

// Describes one tool that an assistant can use. It lists the tool's name,
// what it does, and the input fields (with their types) that it accepts.
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// The catalog of tools offered to AI assistants.
// Each entry defines the name, a human-readable description of what it does,
// and the input fields it expects. An assistant fetches this list first
// (via "tools/list") and then calls a tool by name (via "tools/call").
export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'list_events',
    description: 'Retrieve timetable events for the authenticated student, optionally filtered by date range or category with recurring event expansion.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'Start ISO timestamp (e.g. 2026-09-21T00:00:00Z)' },
        end: { type: 'string', description: 'End ISO timestamp (e.g. 2026-09-28T23:59:59Z)' },
        category: {
          type: 'string',
          enum: ['lecture', 'tutorial', 'lab', 'study', 'exam', 'meeting', 'personal', 'other'],
          description: 'Filter events by category',
        },
        search: { type: 'string', description: 'Keyword search query for title, description, or location' },
        expandRecurring: { type: 'boolean', description: 'Whether to expand recurring series into individual occurrences (default: true)' },
      },
    },
  },
  {
    name: 'create_event',
    description: 'Create a new custom timetable event with automatic schedule conflict detection.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title or course code' },
        description: { type: 'string', description: 'Detailed notes or agenda' },
        location: { type: 'string', description: 'Room number, campus location, or Zoom link' },
        category: {
          type: 'string',
          enum: ['lecture', 'tutorial', 'lab', 'study', 'exam', 'meeting', 'personal', 'other'],
        },
        color: { type: 'string', description: 'Hex color code (e.g. #2563eb)' },
        startTime: { type: 'string', description: 'Start time in ISO 8601 format' },
        endTime: { type: 'string', description: 'End time in ISO 8601 format' },
        allDay: { type: 'boolean', description: 'Whether the event spans the entire day' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
  },
  {
    name: 'detect_clashes',
    description: 'Check if a prospective event time window conflicts with existing events or classes.',
    inputSchema: {
      type: 'object',
      properties: {
        startTime: { type: 'string', description: 'Proposed start time in ISO 8601' },
        endTime: { type: 'string', description: 'Proposed end time in ISO 8601' },
      },
      required: ['startTime', 'endTime'],
    },
  },
  {
    name: 'find_free_slots',
    description: 'Find unallocated free time slots for study sessions, meetings, or revisions on a specific date.',
    inputSchema: {
      type: 'object',
      properties: {
        targetDate: { type: 'string', description: 'Date in YYYY-MM-DD format (e.g. 2026-09-23)' },
        dayStartHour: { type: 'number', description: 'Campus day start hour (default: 9)' },
        dayEndHour: { type: 'number', description: 'Campus day end hour (default: 21)' },
        minDurationMinutes: { type: 'number', description: 'Minimum duration in minutes for free slot (default: 30)' },
      },
      required: ['targetDate'],
    },
  },
  {
    name: 'export_ics',
    description: 'Generate an RFC 5545 iCalendar (.ics) export string for importing into calendar clients.',
    inputSchema: {
      type: 'object',
      properties: {
        calendarName: { type: 'string', description: 'Optional custom calendar title' },
      },
    },
  },
];

// Processes one JSON-RPC request from an AI assistant and returns a reply.
//
// Parameters:
// - userId: whose timetable the request applies to (from the login token).
// - request: the incoming message (jsonrpc version, id, method, params).
//
// What it handles:
// - If the message is not version 2.0, it replies with an "invalid request" error.
// - "tools/list" returns the catalog of available tools (MCP_TOOLS).
// - "tools/call" runs the named tool and returns the result as text.
//   - list_events      -> lists the user's events (optionally filtered/expanded)
//   - create_event     -> creates an event and also reports any schedule clashes
//   - detect_clashes   -> checks whether a time window overlaps existing events
//   - find_free_slots  -> finds free time blocks on a given date
//   - export_ics       -> builds an .ics calendar string the assistant can share
// - Any unknown method or tool name gets a "method not found" error.
// - If a tool throws an error, the reply marks it as an error result.
export function handleMCPRequest(userId: string, request: MCPRequest) {
  const { jsonrpc, id, method, params } = request;

  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
    };
  }

  switch (method) {
    case 'tools/list':
      // Ask an assistant for the list of available tools.
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      };

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      try {
        let contentText = '';

        if (toolName === 'list_events') {
          const events = storage.listEvents(userId, {
            start: args.start,
            end: args.end,
            category: args.category,
            search: args.search,
            expandRecurring: args.expandRecurring !== false,
          });
          contentText = JSON.stringify(events, null, 2);
        } else if (toolName === 'create_event') {
          // Check clash first, so the reply can warn about overlaps.
          const clash = storage.detectClashes(userId, {
            startTime: args.startTime,
            endTime: args.endTime,
          });

          const created = storage.createEvent(userId, args as CreateEventInput);
          contentText = JSON.stringify(
            {
              event: created,
              warning: clash.hasClash ? `Event created with ${clash.clashingEvents.length} clashing event(s)` : undefined,
              clashes: clash.clashingEvents,
            },
            null,
            2
          );
        } else if (toolName === 'detect_clashes') {
          const clash = storage.detectClashes(userId, {
            startTime: args.startTime,
            endTime: args.endTime,
          });
          contentText = JSON.stringify(clash, null, 2);
        } else if (toolName === 'find_free_slots') {
          const slots = storage.findFreeSlots(userId, args.targetDate, {
            dayStartHour: args.dayStartHour,
            dayEndHour: args.dayEndHour,
            minDurationMinutes: args.minDurationMinutes,
          });
          contentText = JSON.stringify(slots, null, 2);
        } else if (toolName === 'export_ics') {
          const events = storage.listEvents(userId, { expandRecurring: false });
          const ics = generateICS(events, args.calendarName || 'Custom Timetable');
          contentText = ics;
        } else {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: unknown tool "${toolName}"` },
          };
        }

        // Wrap the produced text in the standard JSON-RPC "result" shape.
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: contentText,
              },
            ],
          },
        };
      } catch (err: any) {
        // If running the tool failed, return the error message as a result
        // marked with isError: true, so the assistant can read it.
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Error executing tool ${toolName}: ${err.message}`,
              },
            ],
          },
        };
      }
    }

    default:
      // Anything that is not tools/list or tools/call is not supported.
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Procedure not found: "${method}"` },
      };
  }
}
