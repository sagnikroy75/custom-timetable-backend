// This file wires up the authentication endpoints.
// It registers routes for:
// - listing the test users (/users),
// - logging in with email + password (/auth/login),
// - creating a new account (/auth/signup), and
// - showing the current logged-in user's details (/auth/me).
//
// Each route is registered twice: under the root path and under /api.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { requireAuth, signToken, hashPassword, verifyPasswordHash } from '../auth';
import { mongoService, type MongoUserDoc } from '../mongo';

type LoginRequest = FastifyRequest<{ Body: { email?: string; password?: string } }>;
type SignupRequest = FastifyRequest<{
  Body: { email?: string; name?: string; department?: string; password?: string };
}>;

// Turns a full user document into a safe, public version to send to clients.
// It deliberately leaves out private fields like the password hash.
function toPublicUser(user: MongoUserDoc) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    department: user.department,
    studentId: user.studentId,
  };
}

// Cleans up an email address so login and signup matching is case-insensitive
// and whitespace is ignored.
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Registers all the authentication routes on the Fastify app.
//
// Endpoints added:
// GET  /users                  - list the seeded test accounts and their dev tokens
// POST /auth/login             - log in with email and password, get a token
// POST /auth/signup            - create a new account, get a token
// GET  /auth/me                - show the current user (requires authentication)
//
// (Each one is also available under the /api prefix.)
export function registerAuthRoutes(app: FastifyInstance) {
  // Lists every user in the database, along with the dev token that works
  // for them (just their id followed by "-dev-token").
  const usersHandler = async () => {
    const users = (await mongoService.usersCollection.find({}).toArray()).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      studentId: u.studentId,
      department: u.department,
      token: `${u.id}-dev-token`,
    }));
    return { success: true, count: users.length, users };
  };

  app.get('/users', usersHandler);
  app.get('/api/users', usersHandler);

  // Handles login: checks the email and password against the stored user.
  // On success returns the user and a bearer token valid for 7 days.
  const loginHandler = async (req: LoginRequest, reply: FastifyReply) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return reply.status(400).send({ success: false, error: 'email and password are required' });
    }

    const user = await mongoService.usersCollection.findOne({ email: normalizeEmail(email) });
    if (!user || !verifyPasswordHash(password, user.passwordHash)) {
      return reply.status(401).send({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken({ id: user.id, email: user.email, name: user.name });
    return { success: true, token, user: toPublicUser(user) };
  };

  app.post('/auth/login', loginHandler);
  app.post('/api/auth/login', loginHandler);

  // Handles signup: makes sure the fields are present and the password is at
  // least 6 characters, then creates the account (generating a unique id and
  // storing only a password hash). It also rejects duplicate emails.
  const signupHandler = async (req: SignupRequest, reply: FastifyReply) => {
    const { email, name, department, password } = req.body || {};

    if (!email || !email.trim()) {
      return reply.status(400).send({ success: false, error: 'email is required' });
    }
    if (!name || !name.trim()) {
      return reply.status(400).send({ success: false, error: 'name is required' });
    }
    if (!password || password.length < 6) {
      return reply.status(400).send({ success: false, error: 'password must be at least 6 characters' });
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await mongoService.usersCollection.findOne({ email: normalizedEmail });
    if (existing) {
      return reply.status(409).send({ success: false, error: 'A user with this email already exists' });
    }

    const newUser: MongoUserDoc = {
      id: `usr_${crypto.randomBytes(4).toString('hex')}`,
      email: normalizedEmail,
      name: name.trim(),
      department: department?.trim() || 'General Studies',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    await mongoService.usersCollection.insertOne(newUser);

    const token = signToken({ id: newUser.id, email: newUser.email, name: newUser.name });
    return reply.status(201).send({ success: true, token, user: toPublicUser(newUser) });
  };

  app.post('/auth/signup', signupHandler);
  app.post('/api/auth/signup', signupHandler);

  // Shows the currently logged-in user's public details. The requireAuth
  // guard runs first and sets req.user, which tells us who is asking.
  const meHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await mongoService.usersCollection.findOne({ id: req.user!.id });
    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    return { success: true, user: toPublicUser(user) };
  };

  app.get('/auth/me', { preHandler: requireAuth }, meHandler);
  app.get('/api/auth/me', { preHandler: requireAuth }, meHandler);
}
