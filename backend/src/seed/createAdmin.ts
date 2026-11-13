import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { env } from '../config/env.js';
import { closePool, pool } from '../db/pool.js';
import { hashPassword } from '../lib/password.js';
import { passwordRules } from '../modules/auth/schemas.js';

const argsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(80),
});

/** Creates an admin account. The password is read from ADMIN_PASSWORD, never from argv (shell history). */
export async function createAdmin(input: { email: string; name: string; password: string }): Promise<{ id: string }> {
  const { email, name } = argsSchema.parse(input);
  const password = passwordRules.parse(input.password);
  const passwordHash = await hashPassword(password);
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin') RETURNING id`,
      [email, passwordHash, name],
    );
    return { id: rows[0]?.id as string };
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
      throw new Error(`An account with email ${email} already exists`);
    }
    throw err;
  }
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
  const password = env.ADMIN_PASSWORD;
  if (!values.email || !values.name || !password) {
    process.stderr.write('Usage: ADMIN_PASSWORD=<password> npm run create-admin -- --email <email> --name <name>\n');
    process.exitCode = 1;
    await closePool();
  } else {
    try {
      const { id } = await createAdmin({ email: values.email, name: values.name, password });
      process.stdout.write(`Admin created: ${values.email} (${id})\n`);
    } catch (err) {
      process.stderr.write(`create-admin failed: ${err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    } finally {
      await closePool();
    }
  }
}
