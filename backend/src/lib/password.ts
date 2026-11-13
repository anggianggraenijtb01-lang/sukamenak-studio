import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, env.BCRYPT_COST);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);

let dummyHash: Promise<string> | undefined;

/** Burns the same CPU as a real check so unknown emails are not distinguishable by timing. */
export async function verifyAgainstDummy(plain: string): Promise<void> {
  dummyHash ??= bcrypt.hash('timing-equalisation-placeholder', env.BCRYPT_COST);
  await bcrypt.compare(plain, await dummyHash);
}
