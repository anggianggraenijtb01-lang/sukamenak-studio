import type { Role } from '../lib/jwt.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface ValidatedInput {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
      valid?: ValidatedInput;
    }
  }
}
