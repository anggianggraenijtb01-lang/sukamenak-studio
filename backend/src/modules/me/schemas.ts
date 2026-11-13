import { z } from 'zod';
import { passwordRules } from '../auth/schemas.js';

export const updateMeSchemas = {
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      current_password: z.string().min(1).max(200).optional(),
      new_password: passwordRules.optional(),
    })
    .refine((v) => v.name !== undefined || v.new_password !== undefined, {
      message: 'Tidak ada perubahan yang dikirim',
    })
    .refine((v) => v.new_password === undefined || v.current_password !== undefined, {
      message: 'Kata sandi saat ini wajib diisi untuk mengganti kata sandi',
      path: ['current_password'],
    }),
};

export const deleteMeSchemas = {
  body: z.object({
    password: z.string().min(1, 'Kata sandi wajib diisi').max(200),
  }),
};
