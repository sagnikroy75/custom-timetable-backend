# Custom Timetable Backend

This is a Fastify + MongoDB API for timetable events. It handles CRUD, recurring events, clash detection, free-slot lookup, and iCalendar export. It also includes a small MCP tool interface.

> **No MongoDB? No problem.** The app falls back to an in-memory store on its own.

---

## 🚀 Run It

```sh
npm install @fastify/swagger-ui
npm run dev # run the "dev" package script
```

- **API:** `http://localhost:3000`
- **Docs:** `/documentation`
- **OpenAPI spec:** `/openapi.json`

If you don't set `MONGODB_URI`, the app uses the in-memory store with sample data already loaded.

---

## 🗄️ MongoDB Atlas Setup (Optional)

Use this if you want real persistence instead of the in-memory fallback.

1. Sign up at [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register).
2. Create a deployment. Pick the **free M0 tier**, choose any region, and click **Create**.
3. Add a database user (username and password) when prompted.
4. Under **Network Access**, allow your IP (or `0.0.0.0/0` for dev).
5. Click **Connect → Drivers** and copy the connection string.

The string looks like this:

```text
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0
```

Swap in your username and password, then add it to `.env`:

```sh
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0
MONGODB_DB=custom_timetable
```

Restart `npm run dev`. You should see:

```text
Successfully connected to native MongoDB server!
```

### Environment Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | |
| `HOST` | `0.0.0.0` | |
| `MONGODB_URI` | none | Leave this unset to use the in-memory store |
| `MONGODB_DB` | `custom_timetable` | |
| `JWT_SECRET` | dev default | **Change this in production** |

---

## 🐳 Docker

```sh
docker compose up --build
```

This runs the API in a container using the values in your `.env` file (including the Atlas connection string), on port `3000`.

---

## 🔐 Auth

Sign up, then log in with your email and password to get a token:

```sh
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"Your Name","password":"secret1"}'

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret1"}'
```

Send the token like this:

```text
Authorization: Bearer <token>
```

### Demo Accounts

Two seeded demo accounts work right away:

| Email | Password |
| --- | --- |
| `alice@connect.ust.hk` | `alice123` |
| `bob@connect.ust.hk` | `bob123` |

For quick testing without logging in, these also work:

```text
Authorization: Bearer alice-dev-token
Authorization: Bearer bob-dev-token
```

Or use:

```text
x-user-id: alice
```

> Every event is scoped to whoever is authenticated.

---

## 📡 API

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/auth/signup` | Create an account |
| `POST` | `/auth/login` | Log in |
| `GET` | `/auth/me` | Get the current user |
| `GET` | `/events` | List events (`start`, `end`, `category`, `search`, `expandRecurring`) |
| `POST` | `/events` | Create an event |
| `GET` | `/events/:id` | Get one event |
| `PUT`/`PATCH` | `/events/:id` | Update an event |
| `DELETE` | `/events/:id` | Delete an event |
| `POST` | `/events/detect-clashes` | Check if a time range overlaps something |
| `GET` | `/events/free-slots` | Find free time on a given date |
| `GET` | `/events/export.ics` | Export as `.ics` |
| `GET`/`POST` | `/mcp/tools`, `/mcp` | MCP tools |

Every route is also available under `/api/...` (for example, `/api/events`).

---

## 📅 Event Shape

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

---

## 📁 Where Things Live

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

---

## 📜 Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Run with hot reload |
| `npm run build` | Bundle to `dist/server.cjs` |
| `npm start` | Build, then run the bundle |
| `npm run lint` | Type-check |
