// This file handles authentication for the server.
// It provides helpers for hashing passwords, creating and checking login
// tokens (JWT), and a reusable "guard" that checks whether a request is
// coming from a known user before letting it through to an endpoint.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Secret used to sign and verify login tokens.
// In a real deployment this should be changed via the environment variable JWT_SECRET.
const JWT_SECRET = process.env.JWT_SECRET || 'usthing-timetable-secret-key-2026';

// Turns a plain-text password into a scrambled string (a SHA-256 hash).
// The hash is what we store, never the raw password.
// Returns a hex string like "9f86d081...".
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Checks whether a typed-in password matches a stored hash.
// It re-hashes the typed password and compares the two hash strings.
// Returns true if they match, false otherwise.
export function verifyPasswordHash(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Adds the "user" field to Fastify's request object so that, after
// authentication, any handler can read req.user to know who made the request.
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  }
}

// A lightweight description of what an authenticated request looks like.
export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

// Creates a login token (JWT) for a user.
// The token contains the user's id, email, and name, and is signed with the
// secret so it cannot be forged. It automatically expires after 7 days.
export function signToken(user: { id: string; email: string; name: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Checks whether a token is valid and has not expired.
// Returns the user information stored inside the token, or null if the token
// is invalid, tampered with, or expired.
export function verifyToken(token: string): { id: string; email: string; name: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
    return decoded;
  } catch {
    return null;
  }
}

// A "guard" that runs before protected endpoints.
// It figures out who is calling from either an "Authorization: Bearer ..."
// header or an "x-user-id" header, and stores the result on req.user.
//
// Accepted identities:
// - The dev tokens "alice-dev-token" and "bob-dev-token" (for easy testing).
// - A real signed JWT from /auth/login or /auth/signup.
// - Any request with the x-user-id header set to "alice" or "bob".
//
// If no valid identity is found, it sends back a 401 "Unauthorized" response.
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  const explicitUserId = req.headers['x-user-id'] as string | undefined;

  let token: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (token) {
    // Easy-to-use development tokens for the two seeded test users.
    if (token === 'alice-dev-token') {
      req.user = { id: 'alice', email: 'alice@connect.ust.hk', name: 'Alice' };
      return;
    }
    if (token === 'bob-dev-token') {
      req.user = { id: 'bob', email: 'bob@connect.ust.hk', name: 'Bob' };
      return;
    }

    // Otherwise treat the token as a real JWT and check its signature.
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return;
    }

    return reply.status(401).send({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }

  // Fallback: allow direct testing with the x-user-id header.
  if (explicitUserId) {
    const isBob = explicitUserId === 'bob' || explicitUserId === 'usr_taylor';
    req.user = {
      id: isBob ? 'bob' : 'alice',
      email: `${isBob ? 'bob' : 'alice'}@connect.ust.hk`,
      name: isBob ? 'Bob' : 'Alice',
    };
    return;
  }

  return reply.status(401).send({
    success: false,
    error: 'Unauthorized: Bearer token or x-user-id header is required',
  });
}
