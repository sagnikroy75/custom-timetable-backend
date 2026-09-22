export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Custom Timetable Events API',
    description: ``,
    version: '1.0.0'
  },
  tags: [
    { name: 'Events', description: 'Timetable event management and CRUD query operations' },
    { name: 'Scheduling & Clashes', description: 'Schedule conflict detection and available slot calculations' },
    { name: 'Calendar Export', description: 'RFC 5545 standard .ics file export' },
    { name: 'Model Context Protocol (MCP)', description: 'AI assistant JSON-RPC 2.0 integration' },
    { name: 'Auth & Test Users', description: 'User profiles and testing credentials' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        description: 'Provide developer token (e.g. `alice-dev-token` or `bob-dev-token`)',
      },
      HeaderUserId: {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
        description: 'Alternative direct user header for testing (`alice` or `bob`)',
      },
    },
    schemas: {
      RecurrenceRule: {
        type: 'object',
        properties: {
          frequency: {
            type: 'string',
            enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
            example: 'WEEKLY',
          },
          interval: {
            type: 'integer',
            default: 1,
            example: 1,
          },
          byDay: {
            type: 'array',
            items: { type: 'string', enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] },
            example: ['TU', 'TH'],
          },
          count: {
            type: 'integer',
            example: 12,
          },
          until: {
            type: 'string',
            format: 'date-time',
            example: '2026-12-15T23:59:59.000Z',
          },
        },
        required: ['frequency'],
      },
      CustomEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'evt_alice_1' },
          userId: { type: 'string', example: 'alice' },
          title: { type: 'string', example: 'COMP 3511 Operating Systems Project Meeting' },
          description: { type: 'string', example: 'Sprint planning and CPU scheduler milestone review with team.' },
          location: { type: 'string', example: 'Library LG4 Discussion Room 12' },
          category: {
            type: 'string',
            enum: ['lecture', 'tutorial', 'lab', 'study', 'exam', 'meeting', 'personal', 'other'],
            example: 'meeting',
          },
          color: { type: 'string', example: '#2563eb' },
          startTime: { type: 'string', format: 'date-time', example: '2026-09-22T14:30:00.000Z' },
          endTime: { type: 'string', format: 'date-time', example: '2026-09-22T16:00:00.000Z' },
          allDay: { type: 'boolean', example: false },
          recurrence: { $ref: '#/components/schemas/RecurrenceRule' },
          reminders: {
            type: 'array',
            items: { type: 'integer' },
            example: [15, 60],
            description: 'Notification reminders in minutes prior to event start',
          },
          isVirtualInstance: { type: 'boolean', example: false },
          masterEventId: { type: 'string', example: 'evt_alice_1' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'userId', 'title', 'startTime', 'endTime'],
      },
      CreateEventInput: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'COMP 3111 Software Engineering Sprint Review' },
          description: { type: 'string', example: 'Demo sprint deliverables to TA and teammates' },
          location: { type: 'string', example: 'Academic Building Room 2464' },
          category: {
            type: 'string',
            enum: ['lecture', 'tutorial', 'lab', 'study', 'exam', 'meeting', 'personal', 'other'],
            default: 'meeting',
            example: 'meeting',
          },
          color: { type: 'string', default: '#2563eb', example: '#2563eb' },
          startTime: { type: 'string', format: 'date-time', example: '2026-09-24T10:00:00.000Z' },
          endTime: { type: 'string', format: 'date-time', example: '2026-09-24T11:30:00.000Z' },
          allDay: { type: 'boolean', default: false },
          recurrence: { $ref: '#/components/schemas/RecurrenceRule' },
          reminders: { type: 'array', items: { type: 'integer' }, example: [15] },
        },
        required: ['title', 'startTime', 'endTime'],
      },
      ClashCheckInput: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time', example: '2026-09-22T15:00:00.000Z' },
          endTime: { type: 'string', format: 'date-time', example: '2026-09-22T16:30:00.000Z' },
          excludeEventId: { type: 'string', example: 'evt_alice_1' },
        },
        required: ['startTime', 'endTime'],
      },
      MCPRequest: {
        type: 'object',
        properties: {
          jsonrpc: { type: 'string', example: '2.0' },
          id: { type: 'string', example: 'req-1' },
          method: {
            type: 'string',
            enum: ['tools/list', 'tools/call'],
            example: 'tools/call',
          },
          params: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                enum: ['list_events', 'create_event', 'detect_clashes', 'find_free_slots'],
                example: 'detect_clashes',
              },
              arguments: {
                type: 'object',
                example: {
                  startTime: '2026-09-22T15:00:00.000Z',
                  endTime: '2026-09-22T16:00:00.000Z',
                },
              },
            },
          },
        },
        required: ['jsonrpc', 'method'],
      },
    },
  },
  security: [
    { BearerAuth: [] },
    { HeaderUserId: [] },
  ],
  paths: {
    '/events': {
      get: {
        tags: ['Events'],
        summary: 'List user timetable events',
        description: 'Retrieves all events owned by the authenticated student. Automatically expands recurring event series into concrete occurrences within the requested interval.',
        parameters: [
          {
            name: 'start',
            in: 'query',
            description: 'Filter events starting after this ISO 8601 timestamp',
            schema: { type: 'string', format: 'date-time', example: '2026-09-21T00:00:00.000Z' },
          },
          {
            name: 'end',
            in: 'query',
            description: 'Filter events ending before this ISO 8601 timestamp',
            schema: { type: 'string', format: 'date-time', example: '2026-09-28T23:59:59.000Z' },
          },
          {
            name: 'category',
            in: 'query',
            description: 'Filter by event category',
            schema: { type: 'string', enum: ['lecture', 'tutorial', 'lab', 'study', 'exam', 'meeting', 'personal', 'other'] },
          },
          {
            name: 'search',
            in: 'query',
            description: 'Search string matching title, description, or location',
            schema: { type: 'string', example: 'COMP' },
          },
          {
            name: 'expandRecurring',
            in: 'query',
            description: 'When true, expands recurring rules into concrete instances inside the date range',
            schema: { type: 'boolean', default: true },
          },
        ],
        responses: {
          200: {
            description: 'Array of timetable events',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 4 },
                    events: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CustomEvent' },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized - Missing or invalid Bearer token' },
        },
      },
      post: {
        tags: ['Events'],
        summary: 'Create custom timetable event',
        description: 'Creates a custom event or recurring series. The engine automatically checks for conflicts and attaches any detected clash warnings in the response.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateEventInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Event created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    event: { $ref: '#/components/schemas/CustomEvent' },
                    hasClashes: { type: 'boolean', example: false },
                    clashes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CustomEvent' },
                    },
                    warning: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { description: 'Bad Request - Validation error (invalid dates or missing fields)' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/events/{id}': {
      get: {
        tags: ['Events'],
        summary: 'Get event by ID',
        description: 'Retrieves a single timetable event owned by the authenticated student.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'evt_alice_1' } },
        ],
        responses: {
          200: {
            description: 'Event details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    event: { $ref: '#/components/schemas/CustomEvent' },
                  },
                },
              },
            },
          },
          404: { description: 'Event not found or belongs to another student' },
        },
      },
      put: {
        tags: ['Events'],
        summary: 'Replace event',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateEventInput' },
            },
          },
        },
        responses: {
          200: { description: 'Event updated' },
          404: { description: 'Event not found' },
        },
      },
      patch: {
        tags: ['Events'],
        summary: 'Partially update event',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  location: { type: 'string' },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                  category: { type: 'string' },
                  color: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Event patched successfully' },
          404: { description: 'Event not found' },
        },
      },
      delete: {
        tags: ['Events'],
        summary: 'Delete event',
        description: 'Deletes a custom event. If the event has recurrence rules, all projected recurrences are removed.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'evt_alice_1' } },
        ],
        responses: {
          200: {
            description: 'Event deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Event deleted successfully' },
                  },
                },
              },
            },
          },
          404: { description: 'Event not found' },
        },
      },
    },
    '/events/detect-clashes': {
      post: {
        tags: ['Scheduling & Clashes'],
        summary: 'Detect timetable overlaps & clashes',
        description: "Evaluates whether a candidate time window overlaps with any of the user's existing custom events.",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ClashCheckInput' },
            },
          },
        },
        responses: {
          200: {
            description: 'Clash evaluation result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    hasClashes: { type: 'boolean', example: true },
                    clashCount: { type: 'integer', example: 1 },
                    clashes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CustomEvent' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/events/free-slots': {
      get: {
        tags: ['Scheduling & Clashes'],
        summary: 'Find unallocated free study slots',
        description: 'Calculates all open blocks of free time on a specific day between configurable day-start and day-end hours.',
        parameters: [
          {
            name: 'date',
            in: 'query',
            required: true,
            description: 'Target day (YYYY-MM-DD or ISO timestamp)',
            schema: { type: 'string', example: '2026-09-22' },
          },
          {
            name: 'minDurationMinutes',
            in: 'query',
            description: 'Minimum duration in minutes for a slot to qualify',
            schema: { type: 'integer', default: 30, example: 45 },
          },
          {
            name: 'dayStartHour',
            in: 'query',
            description: 'Earliest hour to consider (0-23)',
            schema: { type: 'integer', default: 9, example: 9 },
          },
          {
            name: 'dayEndHour',
            in: 'query',
            description: 'Latest hour to consider (0-23)',
            schema: { type: 'integer', default: 19, example: 18 },
          },
        ],
        responses: {
          200: {
            description: 'List of available free slots',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    date: { type: 'string', example: '2026-09-22' },
                    freeSlotCount: { type: 'integer', example: 3 },
                    freeSlots: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          startTime: { type: 'string', format: 'date-time' },
                          endTime: { type: 'string', format: 'date-time' },
                          durationMinutes: { type: 'integer', example: 90 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/events/export.ics': {
      get: {
        tags: ['Calendar Export'],
        summary: 'Export calendar in RFC 5545 .ics format',
        description: 'Generates a standard RFC 5545 iCalendar data stream containing all user custom events, RRULE recurrence specifications, and alarms.',
        responses: {
          200: {
            description: 'Standard iCalendar data stream',
            content: {
              'text/calendar': {
                schema: {
                  type: 'string',
                  example: 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Custom Timetable//Events Service//EN\n...',
                },
              },
            },
            headers: {
              'Content-Disposition': {
                schema: { type: 'string', example: 'attachment; filename="timetable-alice.ics"' },
              },
            },
          },
        },
      },
    },
    '/mcp': {
      post: {
        tags: ['Model Context Protocol (MCP)'],
        summary: 'Model Context Protocol (MCP) JSON-RPC 2.0 endpoint',
        description: 'Implements the Model Context Protocol tools interface for AI agents, allowing LLMs to list events, create tasks, detect conflicts, and query free slots.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MCPRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'JSON-RPC 2.0 response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jsonrpc: { type: 'string', example: '2.0' },
                    id: { type: 'string', example: 'req-1' },
                    result: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/mcp/tools': {
      get: {
        tags: ['Model Context Protocol (MCP)'],
        summary: 'List available MCP Tools',
        description: 'Returns the catalog of registered MCP tool schemas exposed to AI coding agents.',
        responses: {
          200: {
            description: 'Tools catalog',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tools: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Auth & Test Users'],
        summary: 'List seeded test accounts',
        description: 'Returns pre-seeded test students with their corresponding bearer dev tokens (`alice-dev-token`, `bob-dev-token`).',
        responses: {
          200: {
            description: 'List of student accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    users: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'alice' },
                          name: { type: 'string', example: 'Alice Chan' },
                          email: { type: 'string', example: 'alice@connect.ust.hk' },
                          token: { type: 'string', example: 'alice-dev-token' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/signup': {
      post: {
        tags: ['Auth & Test Users'],
        summary: 'Register a new user',
        description: 'Creates a new user account and returns a bearer token, mirroring the response shape of /auth/login.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'name'],
                properties: {
                  email: { type: 'string', example: 'newstudent@connect.ust.hk' },
                  name: { type: 'string', example: 'New Student' },
                  department: { type: 'string', example: 'Computer Science & Engineering' },
                  password: { type: 'string', example: 'hunter2' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Account created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    token: { type: 'string' },
                    user: { type: 'object' },
                  },
                },
              },
            },
          },
          400: { description: 'Missing required fields' },
          409: { description: 'A user with this email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth & Test Users'],
        summary: 'Log in with email and password',
        description: 'Verifies email/password credentials and returns a bearer token. Seeded demo accounts: alice@connect.ust.hk / alice123 and bob@connect.ust.hk / bob123.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'alice@connect.ust.hk' },
                  password: { type: 'string', example: 'alice123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    token: { type: 'string' },
                    user: { type: 'object' },
                  },
                },
              },
            },
          },
          400: { description: 'Missing email or password' },
          401: { description: 'Invalid email or password' },
        },
      },
    },
  },
};
