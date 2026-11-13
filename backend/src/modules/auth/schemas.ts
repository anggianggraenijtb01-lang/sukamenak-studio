import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Email tidak valid').max(254);

// bcrypt only reads the first 72 bytes, so longer passwords would be silently truncated.
const newPassword = z
  .string()
  .min(8, 'Kata sandi minimal 8 karakter')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Kata sandi maksimal 72 byte');

export const passwordRules = newPassword;
export const emailRules = email;

export const registerSchemas = {
  body: z.object({
    email,
    password: newPassword,
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  }),
};

export const loginSchemas = {
  body: z.object({
    email,
    password: z.string().min(1, 'Kata sandi wajib diisi').max(200),
  }),
};
