# Custom Timetable Backend

Fastify + MongoDB API for timetable events — CRUD, recurring events, clash detection, free-slot lookup, iCalendar export, plus a small MCP tool interface.

No MongoDB? No problem, it falls back to an in-memory store automatically.

## Run it

```sh
npm install
npm run dev/ npm start
```

API runs at `http://localhost:3000`. Docs at `/documentation`, OpenAPI spec at `/openapi.json`.

Without a `MONGODB_URI` set, it just uses the in-memory store with some sample data already in it.

## MongoDB Atlas setup (optional)

If you want real persistence instead of the in-memory fallback:

1. Sign up at [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register).
2. Create a deployment, pick the free M0 tier, any region, hit Create.
3. Add a database user (username/password) when prompted.
4. Under Network Access, allow your IP (or `0.0.0.0/0` for dev).
5. Click Connect → Drivers, copy the connection string.

It'll look like:

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0
```

Swap in your username/password, then put it in `.env`:

```sh
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0
MONGODB_DB=custom_timetable
```

Restart `npm run dev` and you should see `Successfully connected to native MongoDB server!` in the console.

### Env vars

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | |
| `HOST` | `0.0.0.0` | |
| `MONGODB_URI` | none | leave unset to use the in-memory store |
| `MONGODB_DB` | `custom_timetable` | |
| `JWT_SECRET` | dev default | change this in production |

## Docker

```sh
docker compose up --build
```

Runs the API in a container using whatever's in your `.env` (Atlas connection string included), on port `3000`.

## Auth

Sign up, then log in with your email and password to get a token:

```sh
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"Your Name","password":"secret1"}'

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret1"}'
```

Then send the token as:

```text
Authorization: Bearer <token>
```

Two seeded demo accounts also work: `alice@connect.ust.hk` / `alice123` and `bob@connect.ust.hk` / `bob123`.

For quick testing without logging in at all, these also work out of the box:

```text
Authorization: Bearer alice-dev-token
Authorization: Bearer bob-dev-token
```

or just `x-user-id: alice`.

All events are scoped to whoever's authenticated.

## API

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/auth/signup` | create an account |
| `POST` | `/auth/login` | log in |
| `GET` | `/auth/me` | current user |
| `GET` | `/events` | list events (`start`, `end`, `category`, `search`, `expandRecurring`) |
| `POST` | `/events` | create an event |
| `GET` | `/events/:id` | get one event |
| `PUT`/`PATCH` | `/events/:id` | update an event |
| `DELETE` | `/events/:id` | delete an event |
| `POST` | `/events/detect-clashes` | check if a time range overlaps something |
| `GET` | `/events/free-slots` | find free time on a given date |
| `GET` | `/events/export.ics` | export as `.ics` |
| `GET`/`POST` | `/mcp/tools`, `/mcp` | MCP tools |

Everything's also available under `/api/...` (e.g. `/api/events`).

## Event shape

```json
{
  "id": "evt_abc123",
  "userId": "alice",
  "title": "Project meeting",
  "description": "Sprint planning",
  "location": "Library",
  "category": "meeting",
  "color": "#2563eb",
  "startTime": "2026-09-22T14:30:00.000Z",
  "endTime": "2026-09-22T16:00:00.000Z",
  "allDay": false,
  "recurrence": {
    "frequency": "WEEKLY",
    "interval": 1,
    "byDay": ["TU"],
    "until": "2026-12-15T23:59:59.000Z"
  },
  "reminders": [15],
  "createdAt": "2026-09-22T00:00:00.000Z",
  "updatedAt": "2026-09-22T00:00:00.000Z"
}
```

## Where things live

```text
server.ts                       entrypoint
server/app.ts                   builds the app, registers plugins/routes
server/routes/auth-routes.ts    signup, login, current user
server/routes/event-routes.ts   event CRUD, clashes, free slots, ICS export
server/routes/mcp-routes.ts     MCP endpoints
server/routes/system-routes.ts  health check, OpenAPI, docs redirect
server/auth.ts                  JWT helpers + auth pre-handler
server/mongo.ts                 MongoDB adapter + in-memory fallback
server/storage.ts               recurrence, clash detection, free-slot logic
server/ics.ts                   .ics serializer
server/mcp.ts                   MCP tool definitions
server/openapi.ts               OpenAPI schema for Swagger UI
server/types.ts                 shared types
```

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | run with hot reload |
| `npm run build` | bundle to `dist/server.cjs` |
| `npm start` | build + run bundled |
| `npm run lint` | type-check |
