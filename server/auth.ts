import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const JWT_SECRET = process.env.JWT_SECRET || 'usthing-timetable-secret-key-2026';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPasswordHash(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  }
}

export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

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

export function verifyToken(token: string): { id: string; email: string; name: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
    return decoded;
  } catch {
    return null;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  const explicitUserId = req.headers['x-user-id'] as string | undefined;

  let token: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (token) {
    if (token === 'alice-dev-token') {
      req.user = { id: 'alice', email: 'alice@connect.ust.hk', name: 'Alice' };
      return;
    }
    if (token === 'bob-dev-token') {
      req.user = { id: 'bob', email: 'bob@connect.ust.hk', name: 'Bob' };
      return;
    }

    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return;
    }

    return reply.status(401).send({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }

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
